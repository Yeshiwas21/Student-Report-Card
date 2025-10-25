# Copyright (c) 2025, Yeshiwas D. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import  getdate, flt


class StudentReport(Document):
    def validate(self):
        self.validate_duplicated_entry()
        self.calculate_test_result_averages()

    def validate_duplicated_entry(self):
        existings = frappe.get_all("Student Report",
                                   filters={"name":["!=", self.name], "student": self.student, "course":self.course, "academic_year":self.academic_year},
                                   fields={"name", "student", "course"}
                                   )
        if len(existings) > 0:
            for existing in existings:
                if existing:
                    existing_link = ''.join(f"<a href='/app/student-report/{existing.name}'>{existing.name}</a>")
                    frappe.throw(f"The Student '<b>{self.student}</b>'  has another report '<b>{existing_link} </b>' for the same course '<b> {self.course}</b>' in the same academic year '{self.academic_year}'")


    def calculate_test_result_averages(self):
        """Compute weighted averages for Coursework, Unit Test, and Exam per term,
        scaled to their contribution to the term (Coursework 20, Unit Test 30, Exam 50)."""
        
        student = self.student
        course = self.course
        program = self.program
        academic_year = self.academic_year

        # Helper function: weighted average by total possible mark
        def get_weighted_average(test_type, term):
            results = frappe.db.sql("""
                SELECT tr.possible_mark, td.mark_earned
                FROM `tabTest Result` tr
                INNER JOIN `tabTest Result Detail` td ON td.parent = tr.name
                WHERE tr.docstatus = 1
                AND tr.course = %s
                AND tr.program = %s
                AND tr.academic_year = %s
                AND tr.test_type = %s
                AND tr.term = %s
                AND td.student = %s
            """, (course, program, academic_year, test_type, term, student), as_dict=True)

            total_earned = sum(flt(r.mark_earned) for r in results)
            total_possible = sum(flt(r.possible_mark) for r in results)

            if total_possible == 0:
                return 0

            # Return average as fraction of 100
            return (total_earned / total_possible) * 100

        # === COURSEWORK (scaled to 20) ===
        self.coursework_term1_average_mark = get_weighted_average("Coursework", "Term 1") * 0.2
        self.coursework_term2_average_mark = get_weighted_average("Coursework", "Term 2") * 0.2
        self.coursework_term3_average_mark = get_weighted_average("Coursework", "Term 3") * 0.2

        self.coursework_term1_20_percent = get_weighted_average("Coursework", "Term 1") * 0.2
        self.coursework_term2_20_percent = get_weighted_average("Coursework", "Term 2") * 0.2
        self.coursework_term3_20_percent = get_weighted_average("Coursework", "Term 3") * 0.2

        # === UNIT TEST (scaled to 30) ===
        self.unit_test_term1_average_mark = get_weighted_average("Unit Test", "Term 1") * 0.3
        self.unit_test_term2_average_mark = get_weighted_average("Unit Test", "Term 2") * 0.3
        self.unit_test_term3_average_mark = get_weighted_average("Unit Test", "Term 3") * 0.3

        self.unit_test_term1_30_percent = get_weighted_average("Unit Test", "Term 1") * 0.3
        self.unit_test_term2_30_percent = get_weighted_average("Unit Test", "Term 2") * 0.3
        self.unit_test_term3_30_percent = get_weighted_average("Unit Test", "Term 3") * 0.3

        # === EXAM (scaled to 50) ===
        self.exam_term1_average_mark = get_weighted_average("Exam", "Term 1") * 0.5
        self.exam_term2_average_mark = get_weighted_average("Exam", "Term 2") * 0.5
        self.exam_term3_average_mark = get_weighted_average("Exam", "Term 3") * 0.5

        self.exam_term1_50_percent = get_weighted_average("Exam", "Term 1") * 0.5
        self.exam_term2_50_percent = get_weighted_average("Exam", "Term 2") * 0.5
        self.exam_term3_50_percent = get_weighted_average("Exam", "Term 3") * 0.5

        # Total
         # === Total per term (sum of scaled contributions) ===
        self.term1_total = (
            self.coursework_term1_20_percent +
            self.unit_test_term1_30_percent +
            self.exam_term1_50_percent
        )
        self.term2_total = (
           self.coursework_term2_20_percent +
            self.unit_test_term2_30_percent +
            self.exam_term2_50_percent
        )
        self.term3_total = (
           self.coursework_term3_20_percent +
            self.unit_test_term3_30_percent +
            self.exam_term3_50_percent
        )
        self.yearly_average_mark = (self.term1_total + self.term2_total + self.term3_total) / 3
        self.yearly_total_grade = self.get_grade(self.yearly_average_mark)

    def get_grade(grading_scale_name, mark):
        grading_scale = frappe.get_doc("Grading Scale", grading_scale_name)
        if not grading_scale:
            frappe.throw(f"Grading scale '{grading_scale.name}' not found")
        for interval in grading_scale.intervals:
            if mark >= interval.threshold:
                return interval.grade_code


@frappe.whitelist()
def get_academic_year(report_date):
    """Return the Academic Year that covers the given date"""
    date = getdate(report_date)
    year = frappe.db.sql(
        """
        SELECT name
        FROM `tabAcademic Year`
        WHERE %s BETWEEN year_start_date AND year_end_date
        LIMIT 1
        """,
        (date,),
        as_dict=1,
    )
    return year[0].name if year else None


@frappe.whitelist()
def get_student_program(student, academic_year=None):
    """
    Fetches the active program for a given student.
    Optionally filters by academic year.
    """
    filters = {
        "student": student,
        "docstatus": 1
    }

    # Add academic year filter only if provided
    if academic_year:
        filters["academic_year"] = academic_year

    program = frappe.db.get_value("Program Enrollment", filters, "program")
    return program or ""


@frappe.whitelist()
def get_program_courses(doctype, txt, searchfield, start, page_len, filters):
    """Returns courses linked to a Program. Used for Link query."""
    program = filters.get("program")
    if not program:
        return []

    # Fetch linked courses from child table in Program
    courses = frappe.get_all(
        "Program Course",  # child table of Program
        filters={"parent": program},
        fields=["course"],
    )

    # Return as expected by Link query (list of tuples: [link_id])
    course_list = [(c["course"],) for c in courses if txt.lower() in c["course"].lower()]
    return course_list


@frappe.whitelist()
def get_topics_and_comptencies(program, course, academic_year):
    """
    Fetch topics and competencies linked to the given Program, Course, and Academic Term.
    The Academic Year is automatically derived from the selected Term.
    """
    if not (program and course and academic_year):
        frappe.throw(_("Please select Program, Course, and Academic Year."))

    if not academic_year:
        frappe.throw(_("The selected Term is not linked to any Academic Year."))

    data = []

    # 🔹 Get Competencies associated with this Program, Course, and Academic Year
    competencies = frappe.get_all(
        "Competency",
        filters={
            "program": program,
            "course": course,
            "academic_year": academic_year
        },
        fields=["name", "topic"]
    )

    if not competencies:
        return {"status": "no_competencies", "data": []}

    # 🔹 Loop through competencies to fetch topics and their details
    for comp in competencies:
        topic_name = frappe.db.get_value("Topic", comp.topic, "topic_name")

        details = frappe.get_all(
            "Competency Detail",
            filters={"parent": comp.name},
            fields=["competency_description", "grading_scale"],
            order_by="idx asc"
        )

        if details:
            for d in details:
                data.append({
                    "topic_name": topic_name,
                    "competency": d.competency_description,
                    "grading_scale": d.grading_scale
                })
        else:
            data.append({
                "topic_name": topic_name,
                "competency": None,
                "grading_scale": None
            })

    return {"status": "ok", "data": data}



@frappe.whitelist()
def get_grade_codes(grading_scale):
    """Return all grade codes for the given grading scale"""
    if not grading_scale:
        return []

    grading_scale_doc = frappe.get_doc("Grading Scale", grading_scale)
    return [d.grade_code for d in grading_scale_doc.intervals]


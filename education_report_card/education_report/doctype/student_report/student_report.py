# Copyright (c) 2025, Yeshiwas D. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today, getdate


class StudentReport(Document):
    def validate(self):
        self.validate_grades_of_terms()

    def validate_grades_of_terms(self):
        if self.student_report_detail:
            for index, row in enumerate(self.student_report_detail, start=1):
                terms = [row.term1, row.term2, row.term3]

                grade_codes = []
                grading_scale = None

                if row.grading_scale:
                    grading_scale = frappe.get_doc("Grading Scale", row.grading_scale)
                    grade_codes = [d.grade_code for d in grading_scale.intervals]

                # Validation
                if row.topic_name and row.competency and row.grading_scale:
                    for term in terms:
                        if term and term not in grade_codes:
                            frappe.throw(
                                f"Invalid grade '{term}' at row {index}. "
                                f"Allowed grades are: {', '.join(grade_codes)} "
                                f"(Grading Scale: {grading_scale.name})"
                            )

        
@frappe.whitelist()
def get_term_for_date(report_date):
    """Return the Academic Term that covers the given date"""
    date = getdate(report_date)
    term = frappe.db.sql(
        """
        SELECT name
        FROM `tabAcademic Term`
        WHERE %s BETWEEN term_start_date AND term_end_date
        LIMIT 1
        """,
        (date,),
        as_dict=1,
    )
    return term[0].name if term else None

@frappe.whitelist()
def get_student_test_averages(student):
    """
    Get average marks for Coursework, Unit Test, and Exam for a given student
    Only considers submitted Test Results (docstatus = 1)
    """
    results = frappe.db.sql("""
        SELECT tr.test_type, AVG(td.mark_earned) as avg_marks
        FROM `tabTest Result` tr
        INNER JOIN `tabTest Result Detail` td ON tr.name = td.parent
        WHERE td.student = %s
          AND tr.docstatus = 1
        GROUP BY tr.test_type
    """, (student,), as_dict=True)

    averages = {
        "unit_test_percentage": 0,
        "coursework_percentage": 0,
        "exam_percentage": 0
    }

    for r in results:
        if r.test_type == "Unit Test":
            averages["unit_test_percentage"] = r.avg_marks
        elif r.test_type == "Cousework":   # keep "Cousework" since that’s in your DocType
            averages["coursework_percentage"] = r.avg_marks
        elif r.test_type == "Exam":
            averages["exam_percentage"] = r.avg_marks

    return averages

@frappe.whitelist()
def get_student_program(student):
    """Fetches the active program for a given student."""
    program = frappe.db.get_value(
        "Program Enrollment",
        {"student": student, "docstatus": 1},
        "program"
    )
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
def get_topics_and_comptencies(course):
    """
    Fetch topics from Course Topics of the given course,
    then fetch competencies + grading scales for each topic.
    If no competencies found, return only topic.
    """
    data = []

    # 1. Get topics from the Course Topic child table
    course_topics = frappe.get_all(
        "Course Topic",
        filters={"parent": course},
        fields=["topic"]  # Link to Topic
    )

    if not course_topics:
        return {"status": "no_topics", "data": []}

    for ct in course_topics:
        topic_name = frappe.get_value("Topic", ct.topic, "topic_name")

        # 2. Get competencies for this topic
        competencies = frappe.get_all(
            "Competency",
            filters={"topic": ct.topic},
            fields=["name"]
        )

        if not competencies:
            # only topic, no competencies
            data.append({
                "topic_name": topic_name,
                "competency": None,
                "grading_scale": None
            })
            continue

        for comp in competencies:
            details = frappe.get_all(
                "Competency Detail",
                filters={"parent": comp.name, "parenttype": "Competency"},
                fields=["competency_description", "grading_scale"]
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

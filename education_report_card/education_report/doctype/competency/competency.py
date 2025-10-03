# Copyright (c) 2025, Yeshiwas D. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Competency(Document):
    def validate(self):
        self.validate_course()
        self.validate_topic()
        self.validate_duplicated_detail()

    def validate_course(self):
        if self.program:
            program = frappe.get_doc("Program", self.program)
            associated_courses = [row.course for row in program.courses]  # list of course names
            if self.course and self.course not in associated_courses:
                frappe.throw(f"The course <b>'{self.course}'</b> is not associated with program <b>'{program.name}'</b> ")

    def validate_topic(self):
         if self.course:
            course = frappe.get_doc("Course", self.course)
            associated_topics = [row.topic for row in course.topics]  # list of topic names
            if self.topic  and self.topic not in associated_topics:
                frappe.throw(f"The topic <b>'{self.topic}'</b> is not associated with course <b>'{course.name}'</b>")
	
    def validate_duplicated_detail(self):
        if self.detail:
            seen = set()
            for row in self.detail:
                if row.competency_description in seen:
                    frappe.throw(f"Duplicated competency decription <b> '{row.competency_description}' </b>")
                seen.add(row.competency_description)



@frappe.whitelist()
def get_program_courses(doctype, txt, searchfield, start, page_len, filters):
    program = filters.get("program")
    if not program:
        return []

    # Fetch linked courses from child table in Program
    courses = frappe.get_all(
        "Program Course",  # child table of Program
        filters={"parent": program},
        fields=["course"],
    )

    # Return as expected by Link query (list of tuples)
    return [(c["course"],) for c in courses if txt in c["course"]]

@frappe.whitelist()
def get_course_topics(doctype, txt, searchfield, start, page_len, filters):
    """Return topics linked to a given course via Course Topic child table"""
    course = filters.get("course")
    if not course:
        return []

    topics = frappe.get_all(
        "Course Topic",
        filters={"parent": course},
        fields=["topic"]  # assuming child table field is 'topic'
    )
     # Return as expected by Link query (list of tuples)
    return [(t["topic"],) for t in topics if txt in t["topic"]]
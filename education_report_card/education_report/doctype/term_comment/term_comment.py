# Copyright (c) 2025, Yeshiwas D. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TermComment(Document):
    def validate(self):
        self.validate_duplicated_entry()
    def validate_duplicated_entry(self):
        exiting_comments = frappe.get_all(
            "Term Comment",
            filters={"name":["!=", self.name], "academic_year": self.academic_year, "program":self.program, "student":self.student},
            fields={"name"}
            )
        for tc in exiting_comments:
            if len(tc) > 0:
                frappe.throw(f"Term Comment already existed for student:<b>{self.student} </b>, proram/grade: '<b>{self.program }</b>' and academic year:'<b>{self.academic_year} </b>'")
    

@frappe.whitelist()
def get_enrolled_students(doctype, txt, searchfield, start, page_len, filters):
    import json

    if isinstance(filters, str):
        filters = json.loads(filters)

    program = filters.get("program")
    academic_year = filters.get("academic_year")

    if not program or not academic_year:
        return []

    program_enrolments = frappe.get_all(
        "Program Enrollment",
        filters={"program": program, "academic_year": academic_year},
        fields=["student"],
    )

    students = [pe.student for pe in program_enrolments]

    # Frappe link queries must return a list of lists like [['STU-001'], ['STU-002']]
    return [[s] for s in students if txt.lower() in s.lower()]

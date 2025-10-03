# Copyright (c) 2025, Yeshiwas D. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import today, getdate

class TestResult(Document):
	def validate(self):
		self.validate_duplicated_test_detail()
		self.validate_enrolled_only()
		self.validate_mark_earned()

	def validate_duplicated_test_detail(self):
		if self.test_detail:
			seen = set()
			for row in self.test_detail:
				if row.student in seen:
					frappe.throw(f"Duplicated student <b> '{row.student}' </b>")
				seen.add(row.student)

	def validate_enrolled_only(self):
		if self.program:
			program_enrolled = frappe.get_all(
				"Program Enrollment",
				filters={"program": self.program, "docstatus": 1},
				fields=["student", "student_name"]
			)

			enrolled_students = [p.student for p in program_enrolled]
			

			if self.test_detail:
				for row in self.test_detail:  # fixed typo
					if row.student not in enrolled_students:
						frappe.throw(
							f"Student <b>{row.student}</b> is not enrolled in Program <b>{self.program}</b>"
						)
	def validate_mark_earned(self):
		if self.test_detail:
			possible_mark = self.possible_mark or 0

			for index, row in enumerate(self.test_detail, start=1):
				# Treat None as 0
				earned = row.mark_earned or 0

				if earned > possible_mark:
					frappe.throw(
						f"Mark earned cannot be greater than possible mark at row '<b>{index}</b>'"
					)
				
				if earned < 0:
					frappe.throw(
						f"Mark earned cannot be negative at row '<b>{index}</b>'"
					)

@frappe.whitelist()
def get_enrolled_students(program):
    if not program:
        frappe.throw(_("Please select a program first"))

    students = frappe.get_all(
        "Program Enrollment",
        filters={"program": program, "docstatus": 1},
        fields=["student", "student_name"]
    )

    # Return a list of dicts for child table
    return [{"student": s.student, "student_name": s.student_name} for s in students]

@frappe.whitelist()
def get_term_for_date(test_date):
    """Return the Academic Term that covers the given date"""
    date = getdate(test_date)
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
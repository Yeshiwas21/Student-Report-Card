# Copyright (c) 2025, Yeshiwas D. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DirectorMessage(Document):
	def validate(self):
		self.validate_duplicated_entry()
	def validate_duplicated_entry(self):
		exiting_comments = frappe.get_all(
			"Director Message",
			filters={"name":["!=", self.name], "academic_year": self.academic_year},
			fields={"name"}
			)
		for tc in exiting_comments:
			if len(tc) > 0:
				frappe.throw(f"Director Message already existed for academic year:'<b>{self.academic_year} </b>'")

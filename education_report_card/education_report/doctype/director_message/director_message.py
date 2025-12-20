# Copyright (c) 2025, Michel B. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DirectorMessage(Document):
	def validate(self):
		self.validate_duplicated_entry()

	def validate_duplicated_entry(self):
		# Only 1 message per Academic Year + Program/Grade
		if frappe.db.exists(
			"Director Message",
			{
				"name": ["!=", self.name],
				"academic_year": self.academic_year,
				"program": self.program,
			},
		):
			frappe.throw(
				f"Director Message already exists for Academic Year '<b>{self.academic_year}</b>' "
				f"and Program/Grade '<b>{self.program}</b>'."
			)

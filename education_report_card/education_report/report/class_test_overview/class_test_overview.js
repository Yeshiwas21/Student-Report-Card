// Copyright (c) 2025, Yeshiwas D. and contributors
// For license information, please see license.txt

frappe.query_reports["Class Test Overview"] = {
	"filters": [
		{
			fieldname: "academic_year",
			label: "Academic Year",
			fieldtype: "Link",
			options: "Academic Year",
		},
		{
			fieldname: "program",
			label: "Program/Grade",
			fieldtype: "Link",
			options: "Program",
		},

		{
			fieldname: "term",
			label: "Term",
			fieldtype: "Select",
			options: ["", "Term 1", "Term 2", "Term 3"],
		},
		{
			fieldname: "course",
			label: "Course/Subject",
			fieldtype: "Link",
			options: "Course",
		},
		{
			fieldname: "test_type",
			label: "Test Type",
			fieldtype: "Select",
			options: ["", "Coursework", "Unit Test", "Exam"],
		},
		{
			fieldname: "student",
			label: "Student",
			fieldtype: "Link",
			options: "Student",
		},
		{
			fieldname: "teacher",
			label: "Instructor",
			fieldtype: "Link",
			options: "Instructor",
			// default: frappe.session.user_fullname
		}
	]
};

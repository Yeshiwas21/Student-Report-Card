// Copyright (c) 2025, Yeshiwas D. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Competency", {
    refresh(frm) { },

    onload: function (frm) {
        // Course must depend on Program
        frm.set_query("course", function () {
            if (!frm.doc.program) {
                frappe.msgprint(__('Please select a Program first.'));
                return { filters: {} };
            }
            return {
                query: "education_report_card.education_report.doctype.competency.competency.get_program_courses",
                filters: {
                    program: frm.doc.program
                }
            };
        });

        // Topic must depend on Course
        frm.set_query("topic", function () {
            if (!frm.doc.course) {
                frappe.msgprint(__('Please select a Course first.'));
                return { filters: {} };
            }
            return {
                query: "education_report_card.education_report.doctype.competency.competency.get_course_topics",
                filters: {
                    course: frm.doc.course
                }
            };
        });
    },

    program: function (frm) {
        // When Program changes → clear Course & Topic
        frm.set_value("course", "");
        frm.set_value("topic", "");
    },

    course: function (frm) {
        // When Course changes → clear Topic
        frm.set_value("topic", "");
    },
});

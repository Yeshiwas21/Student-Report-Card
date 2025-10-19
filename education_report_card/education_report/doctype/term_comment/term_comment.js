// Copyright (c) 2025, Yeshiwas D. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Term Comment", {
    refresh(frm) {
        // When program or academic year changes, refresh the student filter
        frm.fields_dict["student"].get_query = function () {
            if (!frm.doc.program || !frm.doc.academic_year) {
                frappe.msgprint("Please select Program and Academic Year first.");
                return;
            }
            return {
                query: "education_report_card.education_report.doctype.term_comment.term_comment.get_enrolled_students",
                filters: {
                    program: frm.doc.program,
                    academic_year: frm.doc.academic_year
                }
            };
        };
    },
});

// Copyright (c) 2025, Yeshiwas D. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Test Result', {
    onload: function (frm) {
        const grid = frm.fields_dict.test_detail.grid;

        // 1. Hide Add Row button
        grid.cannot_add_rows = true;


        grid.refresh();

        // Default test_date = today if not set
        if (!frm.doc.test_date) {
            frm.set_value("test_date", frappe.datetime.get_today())
                .then(() => {
                    // Trigger the test_date function after setting the value
                    frm.trigger("test_date");
                });
        } else {
            frm.trigger("test_date");
        }

        // Filter courses based on selected program
        frm.set_query("course", function () {
            if (!frm.doc.program) {
                frappe.msgprint(__("Please select a Program first."));
                return { filters: { name: ["is", "set"], name: "" } };
            }

            return {
                query: "education_report_card.education_report.doctype.student_report.student_report.get_program_courses",
                filters: { program: frm.doc.program }
            };
        });
    },

    test_date: function (frm) {
        if (frm.doc.test_date) {
            frappe.call({
                method: "education_report_card.education_report.doctype.test_result.test_result.get_term_for_date",
                args: {
                    test_date: frm.doc.test_date
                },
                callback: function (r) {
                    if (r.message) {
                        frm.set_value("term", r.message);
                    } else {
                        frappe.msgprint(__("No Academic Term found for this date"));
                        frm.set_value("term", null);
                    }
                }
            });
        }
    },
    program: function (frm) {
        // Clear child table when program changes
        frm.clear_table('test_detail');
        frm.refresh_field('test_detail');

        // Clear course when program changes or is cleared
        frm.set_value("course", "");
    },
    course: function (frm) {
        // Clear child table when program changes
        frm.clear_table('test_detail');
        frm.refresh_field('test_detail');
    },

    get_student: function (frm) {
        if (!frm.doc.program) {
            frappe.msgprint(__('Please select a program first'));
            return;
        }

        frappe.call({
            method: "education_report_card.education_report.doctype.test_result.test_result.get_enrolled_students",
            args: {
                program: frm.doc.program,
                term: frm.doc.term
            },
            callback: function (r) {
                if (r.message) {
                    // Clear existing child rows
                    frm.clear_table("test_detail");

                    // Add fetched students
                    r.message.forEach(function (student) {
                        let row = frm.add_child("test_detail");
                        row.student = student.student;
                        row.student_name = student.student_name; // if your child table has this field
                    });

                    frm.refresh_field("test_detail");
                }
            }
        });
    }
});

// Copyright (c) 2025, Yeshiwas D. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Student Report", {
    setup(frm) {
        frm.set_query("teacher", {
            filters: {
                status: "Active"
            }
        })
        frm.set_query("student", {
            filters: {
                enabled: 1
            }
        })
    },
    onload(frm) {

        const grid = frm.fields_dict.student_report_detail.grid;

        // 1. Hide Add Row button
        grid.cannot_add_rows = true;


        grid.refresh();

        frm.set_query("course", function () {
            if (!frm.doc.program) {
                frappe.msgprint(__('Please select a Program first.'));
                return { filters: {} };
            }
            return {
                query: "education_report_card.education_report.doctype.student_report.student_report.get_program_courses",
                filters: { program: frm.doc.program }
            };
        });
        // Default test_date = today if not set
        if (!frm.doc.report_date) {
            frm.set_value("report_date", frappe.datetime.get_today())
                .then(() => {
                    // Trigger the test_date function after setting the value
                    frm.trigger("report_date");
                });
        } else {
            frm.trigger("report_date");
        }

    },

    report_date: function (frm) {
        if (frm.doc.report_date) {
            frappe.call({
                method: "education_report_card.education_report.doctype.student_report.student_report.get_academic_year",
                args: {
                    report_date: frm.doc.report_date
                },
                callback: function (r) {
                    if (r.message) {
                        frm.set_value("academic_year", r.message);
                    } else {
                        frappe.msgprint(__("No Academic Year found for this  report date"));
                        frm.set_value("academic_year", null);
                    }
                }
            });
        }
    },

    program(frm) {
        frm.set_value("course", "");
    },

    student(frm) {
        if (frm.doc.student) {
            // fetch program
            frappe.call({
                method: "education_report_card.education_report.doctype.student_report.student_report.get_student_program",
                args: {
                    student: frm.doc.student,
                    academic_year: frm.doc.academic_year
                },
                callback(r) {
                    if (r.message) {
                        frm.set_value("program", r.message);
                    } else {
                        frappe.msgprint(__("No active Program Enrollment found for this student"));
                        frm.set_value("program", "");
                    }
                }
            });
        } else {
            frm.set_value("program", "");
        }
    },
    course(frm) {
        frm.clear_table('student_report_detail');
        frm.refresh_field('student_report_detail');

    },
    get_topics_and_comptencies(frm) {
        if (!frm.doc.course) {
            frappe.msgprint(__('Please select a Course first'));
            return;
        }

        frappe.call({
            method: "education_report_card.education_report.doctype.student_report.student_report.get_topics_and_comptencies",
            args: {
                program: frm.doc.program,
                course: frm.doc.course,
                academic_year: frm.doc.academic_year

            },
            callback: function (r) {
                if (!r.message) return;

                // Clear table
                frm.clear_table("student_report_detail");

                if (r.message.status === "no_topics") {
                    frappe.msgprint(__('No Topics found for this course'));
                    frm.refresh_field("student_report_detail");
                    return;
                }

                let competencies_found = false;

                r.message.data.forEach(d => {
                    let row = frm.add_child("student_report_detail");
                    row.topic_name = d.topic_name;
                    if (d.competency) {
                        row.competency = d.competency;
                        row.grading_scale = d.grading_scale;
                        competencies_found = true;
                    }
                });

                frm.refresh_field("student_report_detail");

                if (competencies_found) {
                    frappe.msgprint(__('Topics and Competencies added to the table'));
                } else {
                    frappe.msgprint(__('No Competencies found for this course'));
                }
            }
        });
    }
});


frappe.ui.form.on('Student Report Detail', {
    term1: function (frm, cdt, cdn) {
        validate_term_value(frm, cdt, cdn, 'term1');
    },
    term2: function (frm, cdt, cdn) {
        validate_term_value(frm, cdt, cdn, 'term2');
    },
    term3: function (frm, cdt, cdn) {
        validate_term_value(frm, cdt, cdn, 'term3');
    }
});

function validate_term_value(frm, cdt, cdn, term_field) {
    let row = locals[cdt][cdn];


    // Call server to get grade codes
    frappe.call({
        method: "education_report_card.education_report.doctype.student_report.student_report.get_grade_codes",
        args: { grading_scale: row.grading_scale },
        callback: function (r) {
            if (r.message) {
                let grade_codes = r.message;
                let value = row[term_field];

                if (value && !grade_codes.includes(value)) {
                    frappe.msgprint(
                        __("Invalid grade '{0}' for {1}. Allowed: {2}",
                            [value, row.grading_scale, grade_codes.join(", ")])
                    );
                    frappe.model.set_value(cdt, cdn, term_field, "");
                }
            }
        }
    });
}
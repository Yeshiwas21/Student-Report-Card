let filter_controls = {}; // store all filter controls

frappe.pages['student-report-card'].on_page_load = function (wrapper) {
	let page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Student Report Card',
		single_column: true
	});

	// Render the template
	$(frappe.render_template("student_report_card", {})).appendTo(page.body);

	// Load filters
	load_filters();

	// === Load Reports Button ===
	$('#load_reports').on('click', function () {
		const program = filter_controls.program.get_value();
		const academicYear = filter_controls.academic_year.get_value();
		const course = filter_controls.course.get_value();
		const student = filter_controls.student.get_value();

		if (!academicYear || !program) {
			frappe.msgprint("Please select both Academic Year and Program.");
			return;
		}

		load_reports({ program, academic_year: academicYear, course, student });
	});

	// === Print Report Button ===
	$('<div style="margin-left: 40px; margin-bottom: 12px;">' +
		'<button class="btn btn-primary" id="print_report_btn">Print Report</button>' +
		'</div>').appendTo('#print_button_container');

	// === Print Report Button Handler (Enhanced with Course Summary) ===
	$('#print_report_btn').on('click', function () {
		const reportOutput = $('#report_output');

		if (
			!reportOutput.html() ||
			reportOutput.html().trim() === "" ||
			reportOutput.html().includes("No records found")
		) {
			frappe.msgprint("No records available to print.");
			return;
		}

		const program = filter_controls.program.get_value();
		const academicYear = filter_controls.academic_year.get_value();
		const student = filter_controls.student.get_value();

		if (!program || !academicYear || !student) {
			frappe.msgprint("Please select Academic Year, Program, and Student to print.");
			return;
		}

		let w = window.open('', '', 'height=900,width=1100');
		w.document.write('<html><head><title>Student Report</title><style>');
		w.document.write(`
        body { font-family: 'Times New Roman', serif; margin: 25px; font-size: 12pt; color: #000; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 15px; font-size: 12pt; }
        table, th, td { border: 1px solid black; }
        th, td { padding: 6px; text-align: center; }
        th { background-color: #f5f5f5; font-weight: bold; }
        h1, h2, h3, h4 { text-align: center; margin: 10px 0; }
        .course-section, .overall-summary, .comments-section,
        .director-intro-fr, .director-intro-en,
        .director-conclusion-fr, .director-conclusion-en {
            margin-top: 20px; page-break-inside: avoid; padding: 10px;
            border: 1px solid #000; border-radius: 6px;
        }
        .student-header { margin: 15px 0; font-size: 13pt; }
        .student-header div { margin-bottom: 5px; }
        .course-summary-table { margin-top: 10px; border: 1px solid #000; }
        .course-summary-table th { background-color: #f0f0f0; }
        .overall-row td { font-weight: bold; background-color: #fafafa; }
        @media print {
            body { margin: 0; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
        }
    `);
		w.document.write('</style></head><body>');

		w.document.write(`<h1>${program} Report Card</h1>`);

		// --- Director Intro ---
		frappe.call({
			method: "education_report_card.education_report.page.student_report_card.student_report_card.get_director_message",
			args: { academic_year: academicYear, program: program },
			callback: function (r) {
				const directorMsg = r.message || {};

				if (directorMsg.introduction_france) {
					w.document.write(`
					<div class="director-intro-fr">
						<h2>Message de la Directrice de l’école</h2>
						<p style="text-align: justify;">${directorMsg.introduction_france}</p>
					</div>`);
				}
				if (directorMsg.introduction_english) {
					w.document.write(`
					<div class="director-intro-en">
						<h2>Message from the School Director</h2>
						<p style="text-align: justify;">${directorMsg.introduction_english}</p>
						<div style="text-align:right; margin-top:20px;">
							<span>__________________________</span><br>
							<b>${directorMsg.director_name || ""}</b><br>
							<span>Principal / Directeur</span>
						</div>
					</div>`);
				}

				// --- Student Info ---
				w.document.write(`
				<div class="student-header">
					<div><b>Academic Year:</b> ${academicYear}</div>
					<div><b>Program/Grade:</b> ${program}</div>
					<div><b>Student:</b> ${student}${filter_controls.student.$input.val() ? ' (' + filter_controls.student.$input.val() + ')' : ''}</div>
				</div>
			`);

				// --- Fetch Student Reports ---
				frappe.call({
					method: "education_report_card.education_report.page.student_report_card.student_report_card.get_student_reports",
					args: { filters: { academic_year: academicYear, program: program, student: student } },
					callback: function (r2) {
						const data = r2.message || [];
						const grouped = {};

						data.forEach(row => {
							const course = row.course || "Unknown Course";
							if (!grouped[course]) grouped[course] = { topics: [] };
							grouped[course].topics.push({
								topic_name: row.topic_name,
								competency: row.competency,
								term1: row.term1,
								term2: row.term2,
								term3: row.term3
							});
						});

						const courses = Object.entries(grouped);

						(function renderCourse(i) {
							if (i >= courses.length) return renderOverallGrades();

							const [course, courseData] = courses[i];

							// --- Group topics ---
							let topicGroups = {};
							courseData.topics.forEach(c => {
								if (!topicGroups[c.topic_name]) topicGroups[c.topic_name] = [];
								topicGroups[c.topic_name].push(c);
							});

							const hasCompetency = Object.values(topicGroups).some(comps =>
								comps.some(c => c.competency && c.competency.trim() !== "")
							);

							// --- Fetch Course Summary to decide rendering ---
							frappe.call({
								method: "education_report_card.education_report.page.student_report_card.student_report_card.get_course_summary",
								args: { student, course, program, academic_year: academicYear },
								async: false,
								callback: function (summary) {
									const sr = summary.message || {};

									const allValues = [
										...(sr.coursework || []),
										...(sr.unit_test || []),
										...(sr.exam || []),
										...(sr.trimester_total || [])
									].map(Number);

									const hasNonZero = allValues.some(v => v !== 0 && !isNaN(v));

									// If no competencies AND all averages are zero → skip entirely
									if (!hasCompetency && !hasNonZero) {
										renderCourse(i + 1);
										return;
									}

									// --- Render Course ---
									w.document.write(`<div class="course-section"><h3>Course/Subject: ${course}</h3>`);

									if (hasCompetency) {
										w.document.write(`
									<table>
										<thead>
											<tr>
												<th>Topic Name</th>
												<th>Competency</th>
												<th>Term 1</th>
												<th>Term 2</th>
												<th>Term 3</th>
											</tr>
										</thead>
										<tbody>`);

										for (const [topicName, competencies] of Object.entries(topicGroups)) {
											const valid = competencies.filter(c => c.competency && c.competency.trim() !== "");
											if (valid.length === 0) continue;

											valid.forEach((c, idx) => {
												w.document.write('<tr>');
												if (idx === 0) w.document.write(`<td rowspan="${valid.length}">${topicName}</td>`);
												w.document.write(`<td>${c.competency}</td>`);
												w.document.write(`<td>${c.term1 || ""}</td>`);
												w.document.write(`<td>${c.term2 || ""}</td>`);
												w.document.write(`<td>${c.term3 || ""}</td>`);
												w.document.write('</tr>');
											});
										}
										w.document.write(`</tbody></table>`);
									}

									if (hasNonZero) {
										w.document.write(`
									<table class="course-summary-table">
										<thead>
											<tr>
												<th colspan="2">COURSE SUMMARY</th>
												<th>Term 1</th><th>Term 2</th><th>Term 3</th>
											</tr>
										</thead>
										<tbody>
											<tr><td>COURSEWORK</td><td>20%</td><td>${sr.coursework?.[0] || 0}</td><td>${sr.coursework?.[1] || 0}</td><td>${sr.coursework?.[2] || 0}</td></tr>
											<tr><td>UNIT TEST</td><td>30%</td><td>${sr.unit_test?.[0] || 0}</td><td>${sr.unit_test?.[1] || 0}</td><td>${sr.unit_test?.[2] || 0}</td></tr>
											<tr><td>END OF TERM EXAM</td><td>50%</td><td>${sr.exam?.[0] || 0}</td><td>${sr.exam?.[1] || 0}</td><td>${sr.exam?.[2] || 0}</td></tr>
											<tr><td><b>TRIMESTER TOTAL</b></td><td><b>100%</b></td><td><b>${sr.trimester_total?.[0] || 0}</b></td><td><b>${sr.trimester_total?.[1] || 0}</b></td><td><b>${sr.trimester_total?.[2] || 0}</b></td></tr>
											<tr><td colspan="2"><b>YEARLY TOTAL GRADE</b></td><td colspan="3"><b>${sr.yearly_average_mark || 0} ${sr.yearly_total_grade ? '(' + sr.yearly_total_grade + ')' : ''}</b></td></tr>
										</tbody>
									</table>`);
									}

									w.document.write(`</div>`);
									renderCourse(i + 1);
								}
							});
						})(0);

						function renderOverallGrades() {
							frappe.call({
								method: "education_report_card.education_report.page.student_report_card.student_report_card.get_overall_term_averages",
								args: { student, program, academic_year: academicYear },
								callback: function (res3) {
									const o = res3.message || {};
									const yearlyAvg =
										o.yearly_avg || ((o.term1_avg || 0) + (o.term2_avg || 0) + (o.term3_avg || 0)) / 3;

									const hasNonZero =
										(o.term1_avg || 0) !== 0 ||
										(o.term2_avg || 0) !== 0 ||
										(o.term3_avg || 0) !== 0 ||
										yearlyAvg !== 0;

									if (hasNonZero) {
										w.document.write(`
									<div class="overall-summary">
										<table>
											<thead>
												<tr><th>OVERALL GRADES</th><th>Term 1</th><th>Term 2</th><th>Term 3</th></tr>
											</thead>
											<tbody>
												<tr>
													<td>TRIMESTER AVERAGE / Moyenne trimestrielle</td>
													<td>${o.term1_avg || 0}%</td>
													<td>${o.term2_avg || 0}%</td>
													<td>${o.term3_avg || 0}%</td>
												</tr>
												<tr>
													<td><b>Yearly Average / Moyenne de l’année</b></td>
													<td colspan="3"><b>${yearlyAvg.toFixed(2)}%</b></td>
												</tr>
											</tbody>
										</table>
									</div>`);
									}

									// --- Comments ---
									frappe.call({
										method: "education_report_card.education_report.page.student_report_card.student_report_card.get_term_and_director_comments",
										args: { student, program, academic_year: academicYear },
										callback: function (r4) {
											const t = r4.message?.teacher || {};
											const d = r4.message?.director || {};

											w.document.write(`
										<div class="comments-section">
											<h4><b>Homeroom Teacher’s Comment / Commentaires du Titulaire :</b></h4>
											<p>
												T1: ${t.term1 || "................................"}<br>
												T2: ${t.term2 || "................................"}<br>
												T3: ${t.term3 || "................................"}<br><br>
												<b>Name:</b> ${t.teacher_name || ".........................."} &nbsp;&nbsp;
												<b>(Sign)</b> ..........................
											</p>
											<hr>
											<h4><b>Principal’s Note / Remarque du Directeur :</b></h4>
											<p>
												T1: ${d.term1 || "................................"}<br>
												T2: ${d.term2 || "................................"}<br>
												T3: ${d.term3 || "................................"}<br><br>
												<b>Name:</b> ${d.director_name || ".........................."} &nbsp;&nbsp;
												<b>(Sign)</b> ..........................
											</p>
										</div>`);

											if (directorMsg.conclusion_fr) {
												w.document.write(`<div class="director-conclusion-fr">
												<h3> ${directorMsg.conc_title_fr || 'Décision finale'}</h3>
												<p style="text-align:justify;">${directorMsg.conclusion_fr}</p>
											</div>`);
											}
											if (directorMsg.conclusion_en) {
												w.document.write(`<div class="director-conclusion-en">
												<h3>${directorMsg.conc_title_en || 'Final decision'}</h3>
												<p style="text-align:justify;">${directorMsg.conclusion_en}</p>
											</div>`);
											}

											w.document.write('</body></html>');
											w.document.close();
											setTimeout(() => {
												w.print();
												w.onafterprint = () => w.close();
											}, 600);
										}
									});
								}
							});
						}
					}
				});
			}
		});
	});

};

// === Initialize Filters ===
function load_filters() {
	$('#program_filter, #academic_year_filter, #course_filter, #student_filter').empty();

	// === Academic Year Filter ===
	filter_controls.academic_year = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			label: 'Academic Year',
			options: 'Academic Year',
			fieldname: 'academic_year',
			placeholder: 'Select Academic Year',
			onchange: function () {
				const academicYear = filter_controls.academic_year.get_value();

				// Reset dependent filters
				filter_controls.program.set_value("");
				filter_controls.student.set_value("");
				filter_controls.course.set_value("");
				filter_controls.course.$wrapper.hide();

				if (academicYear) {
					load_programs_by_year(academicYear);
				}
			}
		},
		parent: $('#academic_year_filter'),
		render_input: true,
	});

	// === Program Filter ===
	filter_controls.program = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			label: 'Program',
			options: 'Program',
			fieldname: 'program',
			placeholder: 'Select Program',
			onchange: function () {
				const program = filter_controls.program.get_value();
				const academicYear = filter_controls.academic_year.get_value();

				// Reset dependent filters
				filter_controls.student.set_value("");
				filter_controls.course.set_value("");
				filter_controls.course.$wrapper.hide();

				if (program) {
					filter_controls.course.$wrapper.show();
					load_courses_by_program(program);
					if (academicYear) {
						load_students_by_program_and_year(program, academicYear);
					}
				}
			}
		},
		parent: $('#program_filter'),
		render_input: true,
	});

	// === Course Filter (hidden by default) ===
	filter_controls.course = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			label: 'Course',
			options: 'Course',
			fieldname: 'course',
			placeholder: 'Select Course',
		},
		parent: $('#course_filter'),
		render_input: true,
	});
	filter_controls.course.$wrapper.hide(); // hide initially

	// === Student Filter ===
	filter_controls.student = frappe.ui.form.make_control({
		df: {
			fieldtype: 'Link',
			label: 'Student',
			options: 'Student',
			fieldname: 'student',
			placeholder: 'Select Student',
		},
		parent: $('#student_filter'),
		render_input: true,
	});
}


// === Load programs based on selected academic year ===
function load_programs_by_year(academicYear) {
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Program Enrollment",
			filters: { academic_year: academicYear },
			fields: ["program"],
			limit_page_length: 1000
		},
		callback: function (r) {
			let programs = (r.message || [])
				.map(d => d.program)
				.filter(p => p && p.trim() !== "");

			programs = [...new Set(programs)];

			if (programs.length === 0) {
				set_link_options(filter_controls.program, []);
				filter_controls.program.set_value("");
				filter_controls.student.set_value("");
				frappe.msgprint("No programs found for this academic year.");
				return;
			}

			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Program",
					filters: [["name", "in", programs]],
					fields: ["name"],
					limit_page_length: 1000
				},
				callback: function (res2) {
					let valid_programs = (res2.message || []).map(d => d.name);
					valid_programs.sort((a, b) => a.localeCompare(b));

					set_link_options(filter_controls.program, valid_programs);
					filter_controls.program.set_value("");
					filter_controls.student.set_value("");
				}
			});
		}
	});
}

// === Load students based on selected program & academic year ===
function load_students_by_program_and_year(program, academicYear) {
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Program Enrollment",
			filters: {
				academic_year: academicYear,
				program: program
			},
			fields: ["student"],
			distinct: true
		},
		callback: function (r) {
			const students = [...new Set((r.message || []).map(d => d.student))];
			set_link_options(filter_controls.student, students);
			filter_controls.student.set_value("");
		}
	});
}

// === Load courses from Program Course child table ===
function load_courses_by_program(program) {
	if (!program) {
		set_link_options(filter_controls.course, []);
		filter_controls.course.set_value("");
		return;
	}

	frappe.call({
		method: "frappe.client.get",
		args: {
			doctype: "Program",
			name: program
		},
		callback: function (r) {
			if (!r.message || !r.message.courses) {
				set_link_options(filter_controls.course, []);
				filter_controls.course.set_value("");
				frappe.msgprint("No courses found for the selected program.");
				return;
			}

			let program_courses = (r.message.courses || [])
				.map(c => c.course)
				.filter(c => c && c.trim() !== "");

			program_courses = [...new Set(program_courses)].sort((a, b) => a.localeCompare(b));

			set_link_options(filter_controls.course, program_courses);
			filter_controls.course.set_value("");
		}
	});
}

// === Helper to reset Link options dynamically ===
function set_link_options(control, options) {
	if (!control) return;
	control.df.get_query = () => ({ filters: [["name", "in", options]] });
}

// === Fetch and render reports ===
function load_reports(filters) {
	$('#report_output').empty().html("<p class='text-muted'>Loading...</p>");

	frappe.call({
		method: "education_report_card.education_report.page.student_report_card.student_report_card.get_student_reports",
		args: { filters },
		callback: function (r) {
			$('#report_output').empty();

			if (!r.message || r.message.length === 0) {
				$('#report_output').html("<p class='text-muted'>No records found.</p>");
				return;
			}

			render_reports(r.message);
		}
	});
}


// === Render Reports ===
function render_reports(data) {
	$('#report_output').empty();
	const grouped = {};
	const processed_students = new Set();

	data.forEach(row => {
		const key = `${row.academic_year}_${row.program}_${row.student}_${row.course}`;
		if (!grouped[key]) {
			grouped[key] = {
				program: row.program,
				academic_year: row.academic_year,
				student: row.student,
				student_name: row.student_name,
				courses: {}
			};
		}

		if (!grouped[key].courses[row.course]) {
			grouped[key].courses[row.course] = { topics: {} };
		}

		if (!grouped[key].courses[row.course].topics[row.topic_name]) {
			grouped[key].courses[row.course].topics[row.topic_name] = [];
		}

		grouped[key].courses[row.course].topics[row.topic_name].push({
			competency: row.competency,
			term1: row.term1,
			term2: row.term2,
			term3: row.term3
		});
	});

	// Fetch director message for the first academic year + program
	const program = $('[data-fieldname="program"] input').val();
	const firstAcademicYear = data[0]?.academic_year;
	if (firstAcademicYear && program) {
		frappe.call({
			method: "education_report_card.education_report.page.student_report_card.student_report_card.get_director_message",
			args: { academic_year: firstAcademicYear, program: program },
			callback: function (r) {
				if (r.message) {
					const director = r.message.director_name || "";
					const intro_fr = r.message.introduction_france?.trim();
					const intro_en = r.message.introduction_english?.trim();
					let intro_html = "";

					if (intro_fr) {
						intro_html += `<div class="director-intro-fr bg-white border-2 border-gray-800 rounded-lg p-6 mb-6">
                            <h2 style="text-align: center; font-weight: bold; font-size: 20pt; margin-bottom: 20px;">Message de la Directrice de l’école.</h2>
                            <p style="text-align: justify; font-size: 12pt; margin-bottom: 20px;">${intro_fr}</p></div>`;
					}

					if (intro_en) {
						intro_html += `<div class="director-intro-en bg-white border-2 border-gray-800 rounded-lg p-6 mb-6">
                            <h2 style="text-align: center; font-weight: bold; font-size: 20pt; margin-bottom: 20px;">Message from the School Director.</h2>
                            <p style="text-align: justify; font-size: 12pt; margin-bottom: 40px;">${intro_en}</p>
                            <div style="text-align: right; font-size: 12pt;">
                                <span>__________________________</span><br>
                                <span><b>${director}</b></span><br>
                                <span>Principal / Directeur</span>
                            </div>
                        </div>`;
					}

					if (intro_html) {
						// $('#report_output').prepend(intro_html);
					}
				}

				// After intro, render all student cards
				render_student_cards(grouped, processed_students);
			}
		});
	} else {
		render_student_cards(grouped, processed_students);
	}
}

// === Render Student Cards, Summaries, Comments ===
function render_student_cards(grouped, processed_students) {
	Object.values(grouped).forEach(g => {
		const student = g.student;
		if (!processed_students.has(student)) {
			processed_students.add(student);

			// Overall Term Averages
			frappe.call({
				method: "education_report_card.education_report.page.student_report_card.student_report_card.get_overall_term_averages",
				args: { student: student, program: g.program, academic_year: g.academic_year },
				callback: function (res) {
					const term_averages = res.message || { term1_avg: 0, term2_avg: 0, term3_avg: 0 };
					g.term_averages = term_averages;

					// Teacher & Director Comments
					frappe.call({
						method: "education_report_card.education_report.page.student_report_card.student_report_card.get_term_and_director_comments",
						args: { student: student, program: g.program, academic_year: g.academic_year },
						callback: function (r2) {
							g.comments = r2.message || null;

							// Once both fetched, render student courses
							render_student_courses(g);
						}
					});
				}
			});
		} else {
			// Already processed student courses
			render_student_courses(g);
		}
	});
}

// === Render individual student courses ===
function render_student_courses(g) {
	Object.entries(g.courses).forEach(([course, courseData]) => {
		const summaryId = `summary_${g.student}_${course}`.replace(/[^\w]/g, '_');

		let html = `
            <div class="student-report-card" 
                 style="
                    background-color: #ffffff;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    padding: 24px;
                    margin-top: 24px;
                    margin-bottom: 24px;
                    border: 2px solid #000;
                    border-radius: 12px;
                    margin-left: 40px;
                    font-family: 'Times New Roman', serif;
                 ">
                
                <!-- Student Info -->
                <div class="student-info" style="padding-left: 20px; margin-bottom: 16px;">
                    <div style="font-size: 16pt; font-weight: bold; margin-bottom: 6px;">Academic Year: ${g.academic_year}</div>
                    <div style="font-size: 16pt; font-weight: bold; margin-bottom: 6px;">Program/Grade: ${g.program}</div>
                    <div style="font-size: 16pt; font-weight: bold; margin-bottom: 6px;">Student: ${g.student}${g.student_name ? ' (' + g.student_name + ')' : ''}</div>
                    <div style="font-size: 16pt; font-weight: bold; margin-bottom: 12px;">Course/Subject: ${course}</div>
                </div>

                <!-- Table -->
                <table style="
                    width: 95%;
                    border-collapse: collapse;
                    border: 2px solid #000;
                    font-size: 14pt;
                    margin-bottom: 16px;
                    margin-left: 20px;
                ">
                    <thead style="background-color: #e0e0e0; text-transform: uppercase; font-weight: bold; font-size: 14pt;">
                        <tr>
                            <th style="border: 2px solid #000; padding: 8px; text-align: left;">Course Total</th>
                            <th style="border: 2px solid #000; padding: 8px; text-align: center;">Term 1</th>
                            <th style="border: 2px solid #000; padding: 8px; text-align: center;">Term 2</th>
                            <th style="border: 2px solid #000; padding: 8px; text-align: center;">Term 3</th>
                        </tr>
                    </thead>
                    <tbody id="${summaryId}">
                        <tr>
                            <td colspan="4" style="text-align:center; color:#555; padding: 12px; border: 2px solid #000;">Loading course summary...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

		$('#report_output').append(html);

		// Load course summary
		frappe.call({
			method: "education_report_card.education_report.page.student_report_card.student_report_card.get_course_summary",
			args: {
				student: g.student,
				course: course,
				program: g.program,
				academic_year: g.academic_year
			},
			callback: function (res) {
				const sr = res.message || {};
				const summaryHtml = `
                    <tr>
                        <td style="border: 2px solid #000; padding: 8px; font-weight:bold;">TRIMESTER TOTAL</td>
                        <td style="border: 2px solid #000; padding: 8px; text-align:center;">${sr.trimester_total?.[0] || 0}</td>
                        <td style="border: 2px solid #000; padding: 8px; text-align:center;">${sr.trimester_total?.[1] || 0}</td>
                        <td style="border: 2px solid #000; padding: 8px; text-align:center;">${sr.trimester_total?.[2] || 0}</td>
                    </tr>
                    <tr>
                        <td style="border: 2px solid #000; padding: 8px; font-weight:bold;">YEARLY TOTAL GRADE</td>
                        <td style="border: 2px solid #000; padding: 8px; text-align:center;" colspan="3">${sr.yearly_average_mark || 0} ${sr.yearly_total_grade ? '(' + sr.yearly_total_grade + ')' : ''}</td>
                    </tr>
                `;
				$(`#${summaryId}`).html(summaryHtml);
			}
		});
	});
}

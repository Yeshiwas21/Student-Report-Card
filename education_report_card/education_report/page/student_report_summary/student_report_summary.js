frappe.pages['student-report-summary'].on_page_load = function (wrapper) {
	let page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Student Report Summary',
		single_column: true
	});

	$(frappe.render_template("student_report_summary", {})).appendTo(page.body);
	load_filters();

	$('#load_reports').on('click', function () {
		const academicYear = $('#academic_year').val();
		const program = $('#program').val();
		if (!program) {
			frappe.msgprint("Please select a Program to load the report.");
			return;
		}
		if (!academicYear) {
			frappe.msgprint("Please select an Academic Year to load the report.");
			return;
		}

		load_reports();
	});

	// === Print Button ===
	$('<button class="btn btn-primary mb-3">Print Report</button>')
		.insertAfter('.filter-card')
		.on('click', function () {
			const reportOutput = $('#report_output');
			if (!reportOutput.html() || reportOutput.html().trim() === "" || reportOutput.html().includes("No records found")) {
				frappe.msgprint("No records available to print.");
				return;
			}

			let w = window.open('', '', 'height=900,width=1100');
			w.document.write('<html><head><title>Student Report</title>');
			w.document.write('<style>');
			w.document.write(`
            body { font-family: 'Times New Roman', serif; margin: 20px; font-size: 12pt; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
            table, th, td { border: 1px solid black; }
            th, td { padding: 6px; text-align: left; }
            h2, h3 { text-align: center; margin: 10px 0; }
            .course-section { margin-bottom: 25px; page-break-inside: avoid; }
            .overall-summary, .comments-section { margin-top: 20px; }
            .director-intro-fr, .director-intro-en, .director-conclusion-fr, .director-conclusion-en { margin-bottom: 10px; }
            .student-header { margin-bottom: 20px; text-align: left; }
            .student-header div { margin-bottom: 5px; }
            @media print {
                body { margin: 0; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; page-break-after: auto; }
            }
        `);
			w.document.write('</style></head><body>');

			const selectedProgram = $('#program').val();
			if (selectedProgram) {
				w.document.write(`
					<h2 style="text-align: center; font-size: 28pt; font-weight: bold; margin-bottom: 30px;">
						${selectedProgram} Report Card
					</h2>
				`);
			}

			const directorIntro = reportOutput.find('.director-intro-fr, .director-intro-en').clone();
			directorIntro.each(function () {
				w.document.write($(this).prop('outerHTML'));
			});

			const firstCard = reportOutput.find('.student-report-card').first();
			if (firstCard.length) {
				const studentHtml = `
                <div class="student-header">
                    <div><b>Academic Year:</b> ${firstCard.find('div.flex > div').eq(0).html()}</div>
                    <div><b>Program/Grade:</b> ${firstCard.find('div.flex > div').eq(1).html()}</div>
                    <div><b>Student:</b> ${firstCard.find('div.flex > div').eq(2).html()}</div>
                </div>
            `;
				w.document.write(studentHtml);
			}

			const studentReports = reportOutput.find('.student-report-card');
			studentReports.each(function () {
				const courseSection = $(this).clone();
				courseSection.find('.flex').remove();
				w.document.write(`<div class="course-section">${courseSection.html()}</div>`);
			});

			const overallAndComments = reportOutput.find('.overall-summary, .comments-section').clone();
			overallAndComments.each(function () {
				w.document.write($(this).prop('outerHTML'));
			});

			const directorConclusion = reportOutput.find('.director-conclusion-fr, .director-conclusion-en').clone();
			directorConclusion.each(function () {
				w.document.write($(this).prop('outerHTML'));
			});

			w.document.write('</body></html>');
			w.document.close();

			setTimeout(() => {
				w.print();
				w.onafterprint = () => w.close();
			}, 600);
		});

};

// === Load Dropdown Filters ===
function load_filters() {
	frappe.db.get_list('Program', { fields: ['name'] }).then(res => {
		res.forEach(r => $('#program').append(`<option>${r.name}</option>`));
	});
	frappe.db.get_list('Academic Year', { fields: ['name'] }).then(res => {
		res.forEach(r => $('#academic_year').append(`<option>${r.name}</option>`));
	});
	frappe.db.get_list('Course', { fields: ['name'] }).then(res => {
		res.forEach(r => $('#course').append(`<option>${r.name}</option>`));
	});
	frappe.db.get_list('Student', { fields: ['name', 'student_name'] }).then(res => {
		res.forEach(r => $('#student').append(`<option value="${r.name}">${r.student_name}</option>`));
	});
}

// === Fetch and Render Reports ===
function load_reports() {
	const filters = {
		program: $('#program').val() || null,
		academic_year: $('#academic_year').val() || null,
		course: $('#course').val() || null,
		student: $('#student').val() || null
	};

	$('#report_output').empty().html("<p class='text-muted'>Loading...</p>");

	frappe.call({
		method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_student_reports",
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

// === Render Student Report Cards ===
function render_reports(data) {
	$('#report_output').empty();
	const grouped = {};
	const processed_students = new Set();
	const selectedStudent = $('#student').val();

	data.forEach(row => {
		const academic_year = row.academic_year || "Unknown Academic Year";
		const program = row.program || "Unknown Program";
		const student = row.student || "Unknown Student";
		const student_name = row.student_name ? ` (${row.student_name})` : "";
		const course = row.course || "Unknown Course";
		const key = `${academic_year}_${program}_${student}_${course}`;

		if (!grouped[key]) {
			grouped[key] = { program, academic_year, student, student_name, courses: { [course]: { topics: {} } } };
		}

		if (!grouped[key].courses[course].topics[row.topic_name]) {
			grouped[key].courses[course].topics[row.topic_name] = [];
		}

		grouped[key].courses[course].topics[row.topic_name].push({
			competency: row.competency,
			term1: row.term1,
			term2: row.term2,
			term3: row.term3
		});
	});

	const program = $('#program').val();
	const firstAcademicYear = data[0]?.academic_year;
	if (firstAcademicYear && selectedStudent && program) {
		frappe.call({
			method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_director_message",
			args: { academic_year: firstAcademicYear, program: program },
			callback: function (r) {
				if (r.message) {
					const director = r.message.director_name || "";
					const intro_fr = r.message.introduction_france?.trim();
					const intro_en = r.message.introduction_english?.trim();

					let intro_html = "";

					if (intro_fr) {
						const header_france = "Message de la Directrice de l’école.";
						intro_html += `
                            <div class="director-intro-fr bg-white border-2 border-gray-800 rounded-lg p-6 mb-6">
                                <h2 style="text-align: center; font-weight: bold; font-size: 20pt; margin-bottom: 20px;">
                                    ${header_france}
                                </h2>
                                <p style="text-align: justify; font-size: 12pt; margin-bottom: 20px;">
                                    ${intro_fr}
                                </p>
                            </div>`;
					}

					if (intro_en) {
						const header_english = "Message from the School Director.";
						intro_html += `
                            <div class="director-intro-en bg-white border-2 border-gray-800 rounded-lg p-6 mb-6">
                                <h2 style="text-align: center; font-weight: bold; font-size: 20pt; margin-bottom: 20px;">
                                    ${header_english}
                                </h2>
                                <p style="text-align: justify; font-size: 12pt; margin-bottom: 40px;">
                                    ${intro_en}
                                </p>
                                <div style="text-align: right; font-size: 12pt;">
                                    <span>__________________________</span><br>
                                    <span><b>${director}</b></span><br>
                                    <span>Principal / Directeur</span>
                                </div>
                            </div>`;
					}

					if (intro_html) {
						$('#report_output').prepend(intro_html);
					}
				}

				render_student_cards(grouped, selectedStudent, processed_students);
			}
		});
	} else {
		render_student_cards(grouped, selectedStudent, processed_students);
	}
}

// --- Separate function to render student cards, summaries, and comments
function render_student_cards(grouped, selectedStudent, processed_students) {
	Object.values(grouped).forEach(g => {
		frappe.db.get_value('Program', g.program, 'show_course_summary').then(res => {
			const show_summary = res.message.show_course_summary;

			Object.entries(g.courses).forEach(([course, courseData]) => {
				const summaryId = `summary_${g.student}_${course}`.replace(/\s+/g, '_');

				let html = `
                    <div class="student-report-card bg-white shadow-md rounded-lg p-4 mb-6 border border-black" data-show-summary="${show_summary}">
                        <div class="flex flex-wrap justify-between text-sm text-gray-700 mb-3">
                            <div><b>Academic Year:</b> ${g.academic_year}</div>
                            <div><b>Program/Grade:</b> ${g.program}</div>
                            <div><b>Student:</b> ${g.student}${g.student_name}</div>
                        </div>
                        <h5 class="text-md font-semibold text-blue-600 mb-2">Course: ${course}</h5>
                        <table class="table table-bordered w-full text-sm border border-black">
                            <thead class="bg-gray-100 border border-black">
                                <tr>
                                    <th>Topic Name</th><th>Competency</th><th>Term 1</th><th>Term 2</th><th>Term 3</th>
                                </tr>
                            </thead>
                            <tbody>`;

				Object.entries(courseData.topics).forEach(([topic, comps]) => {
					comps.forEach((c, idx) => {
						html += `
                            <tr>
                                ${idx === 0 ? `<td rowspan="${comps.length}" class="font-medium border border-black">${topic}</td>` : ""}
                                <td>${c.competency || ""}</td>
                                <td>${c.term1 || ""}</td>
                                <td>${c.term2 || ""}</td>
                                <td>${c.term3 || ""}</td>
                            </tr>`;
					});
				});

				if (show_summary) {
					html += `<tr id="${summaryId}"><td colspan="5" class="text-center text-gray-500">Loading course summary...</td></tr>`;
				}

				html += `</tbody></table></div>`;
				$('#report_output').append(html);

				if (show_summary) {
					frappe.call({
						method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_course_summary",
						args: { student: g.student, course: course, program: g.program, academic_year: g.academic_year },
						callback: function (res) {
							const sr = res.message || {};
							const summaryHtml = `
                                <tr><td colspan="2"><b>COURSE SUMMARY</b></td><td></td><td></td><td></td></tr>
                                <tr><td>COURSEWORK</td><td>20%</td><td>${sr.coursework?.[0] || 0}</td><td>${sr.coursework?.[1] || 0}</td><td>${sr.coursework?.[2] || 0}</td></tr>
                                <tr><td>UNIT TEST</td><td>30%</td><td>${sr.unit_test?.[0] || 0}</td><td>${sr.unit_test?.[1] || 0}</td><td>${sr.unit_test?.[2] || 0}</td></tr>
                                <tr><td>END OF TERM EXAM</td><td>50%</td><td>${sr.exam?.[0] || 0}</td><td>${sr.exam?.[1] || 0}</td><td>${sr.exam?.[2] || 0}</td></tr>
                                <tr><td>TRIMESTER TOTAL</td><td>100%</td><td>${sr.trimester_total?.[0] || 0}</td><td>${sr.trimester_total?.[1] || 0}</td><td>${sr.trimester_total?.[2] || 0}</td></tr>
                                <tr><td>YEARLY TOTAL GRADE</td><td colspan="4">${sr.yearly_average_mark || 0} ${sr.yearly_total_grade ? '(' + sr.yearly_total_grade + ')' : ''}</td></tr>`;
							$(`#summary_${g.student}_${course.replace(/\s+/g, '_')}`).replaceWith(summaryHtml);
						}
					});
				}

				// --- Overall summary & comments ---
				if (selectedStudent && !processed_students.has(g.student)) {
					processed_students.add(g.student);

					frappe.call({
						method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_overall_term_averages",
						args: { student: g.student, program: g.program, academic_year: g.academic_year },
						callback: function (res) {
							if (res.message) {
								const { term1_avg, term2_avg, term3_avg, yearly_average } = res.message;
								const yearlyAvg = yearly_average !== undefined ? yearly_average : ((term1_avg || 0) + (term2_avg || 0) + (term3_avg || 0)) / 3;

								// ✅ Only show overall grade when show_summary = true
								if (show_summary) {
									const overall_html = `
										<div class="overall-summary bg-white border border-black rounded-lg p-4 mt-6 text-sm">
											<table class="table table-bordered w-auto text-sm border border-black">
												<thead class="bg-gray-100">
													<tr>
														<th>OVERALL GRADES:</th>
														<th class="text-center">Term1</th>
														<th class="text-center">Term2</th>
														<th class="text-center">Term3</th>
													</tr>
												</thead>
												<tbody>
													<tr>
														<td class="font-medium">TRIMESTER AVERAGE / Moyenne trimestrielle</td>
														<td class="text-center">${term1_avg || 0}%</td>
														<td class="text-center">${term2_avg || 0}%</td>
														<td class="text-center">${term3_avg || 0}%</td>
													</tr>
													<tr>
														<td class="font-medium">Yearly Average / Moyenne de l’année</td>
														<td class="text-center" colspan="3">${yearlyAvg.toFixed(2)}%</td>
													</tr>
												</tbody>
											</table>
										</div>`;
									$('#report_output').append(overall_html);
								}

								// ✅ Always load comments (even if show_summary = false)
								frappe.call({
									method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_term_and_director_comments",
									args: { student: g.student, program: g.program, academic_year: g.academic_year },
									callback: function (r2) {
										if (r2.message) {
											const t = r2.message.teacher;
											const d = r2.message.director;

											const comments_html = `
												<div class="comments-section bg-white border-2 border-gray-800 rounded-lg p-6 mt-8 text-sm">
													<h4><b>Homeroom Teacher’s Comment / Commentaires du Titulaire :</b></h4>
													<p>
														T1: ${t.term1 || ".................................................."}<br>
														T2: ${t.term2 || ".................................................."}<br>
														T3: ${t.term3 || ".................................................."}<br><br>
														<b>Name:</b> ${t.teacher_name || "..........................................."} &nbsp;&nbsp;
														<b>(Sign)</b> ...........................................
													</p>
													<hr>
													<h4><b>Principal’s Note / Remarque du Directeur :</b></h4>
													<p>
														T1: ${d.term1 || ".................................................."}<br>
														T2: ${d.term2 || ".................................................."}<br>
														T3: ${d.term3 || ".................................................."}<br><br>
														<b>Name:</b> ${d.director_name || "..........................................."} &nbsp;&nbsp;
														<b>(Sign)</b> ...........................................
													</p>
												</div>`;
											$('#report_output').append(comments_html);

											// ✅ Fetch director introduction & conclusion
											frappe.call({
												method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_director_message",
												args: { academic_year: g.academic_year, program: g.program },
												callback: function (r3) {
													if (r3.message) {
														const msg = r3.message;
														const intro_fr = msg.introduction_france?.trim();
														const intro_en = msg.introduction_english?.trim();
														const conclusion_fr = msg.conclusion_fr?.trim();
														const conclusion_en = msg.conclusion_en?.trim();
														if (conclusion_fr) {
															$('#report_output').append(`
															<div class="director-conclusion-fr bg-white border-2 border-gray-800 rounded-lg p-6 mt-8">
																<h2 style="text-align:left; font-weight:bold; font-size:18pt; margin-bottom:20px;">
																	Décision finale
																</h2>
																<p style="text-align:justify; font-size:12pt; margin-bottom:30px;">
																	${conclusion_fr}
																</p>
					
															</div>`);
														}

														if (conclusion_en) {
															$('#report_output').append(`
															<div class="director-conclusion-en bg-white border-2 border-gray-800 rounded-lg p-6 mt-8">
																<h2 style="text-align:left; font-weight:bold; font-size:18pt; margin-bottom:20px;">
																	Finale decision
																</h2>
																<p style="text-align:justify; font-size:12pt; margin-bottom:30px;">
																	${conclusion_en}
																</p>
													
															</div>`);
														}
													}
												}
											});
										}
									}
								});

							}
						}
					});
				}
			});
		});
	});
}

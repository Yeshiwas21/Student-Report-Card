frappe.pages['student-report-summary'].on_page_load = function (wrapper) {
	let page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Student Report Summary',
		single_column: true
	});

	$(frappe.render_template("student_report_summary", {})).appendTo(page.body);
	load_filters();

	$('#load_reports').on('click', function () {
		load_reports();
	});

	// === Print Button ===
	$('<button class="btn btn-primary mb-3">Print Report</button>')
		.insertAfter('.filter-card')
		.on('click', function () {
			const reportContent = document.getElementById('report_output').innerHTML;
			if (!reportContent || reportContent.trim() === "" || reportContent.includes("No records found")) {
				frappe.msgprint("No records available to print.");
				return;
			}

			let w = window.open('', '', 'height=900,width=1100');
			w.document.write('<html><head><title>Student Report</title>');
			w.document.write('<style>');
			w.document.write(`
				body { font-family: Arial, sans-serif; margin: 20px; }
				table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
				table, th, td { border: 1px solid black; }
				th, td { padding: 8px; text-align: left; }
				.student-report-card {
					margin-bottom: 40px;
					border: 1px solid black;
					padding: 15px;
					page-break-after: always;
				}
				.student-report-card:last-of-type { page-break-after: auto !important; }
				h2 { text-align: center; margin-bottom: 10px; }
				.text-sm { font-size: 12px; }
				.text-md { font-size: 14px; }
				.text-blue-600 { color: #2563eb; }
				.text-gray-700 { color: #374151; }
				@media print {
					body { margin: 0; }
					.student-report-card {
						page-break-inside: avoid;
						margin: 0;
						padding: 10px;
					}
					@page { margin: 10mm 10mm 10mm 10mm; }
				}
			`);
			w.document.write('</style></head><body>');

			const wrapperDiv = $('<div>').html(reportContent);
			const studentReports = wrapperDiv.find('.student-report-card');

			let currentStudent = "";
			studentReports.each(function () {
				const studentHeader = $(this).find('div:contains("Student:")').text();
				const studentName = studentHeader.match(/Student:\s*(.+)/)?.[1]?.trim();

				if (studentName && studentName !== currentStudent) {
					if (currentStudent !== "") {
						w.document.write(`<div style="page-break-after: always;"></div>`);
					}
					currentStudent = studentName;
					w.document.write(`<h2>Student Report Summary</h2>`);
				}
				w.document.write($(this).prop('outerHTML'));
			});

			// === Append Overall Grades + Comments (if a student is selected) ===
			const selectedStudent = $('#student').val();
			if (selectedStudent) {
				const overallAndComments = $('.overall-summary, .comments-section').clone();
				if (overallAndComments.length > 0) {
					w.document.write('<div class="print-extras">');
					overallAndComments.each(function () {
						w.document.write($(this).prop('outerHTML'));
					});
					w.document.write('</div>');
				}
			}

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
	let html = "";
	const grouped = {};
	const processed_students = new Set();
	const selectedStudent = $('#student').val();

	// Group data
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

	// Render per student/course
	Object.values(grouped).forEach(g => {
		Object.entries(g.courses).forEach(([course, courseData]) => {
			const summaryId = `summary_${g.student}_${course}`.replace(/\s+/g, '_');

			html += `
				<div class="student-report-card bg-white shadow-md rounded-lg p-4 mb-6 border border-black">
					<div class="flex flex-wrap justify-between text-sm text-gray-700 mb-3">
						<div><b>Academic Year:</b> ${g.academic_year}</div>
						<div><b>Program/Grade:</b> ${g.program}</div>
						<div><b>Student:</b> ${g.student}${g.student_name}</div>
					</div>
					<h5 class="text-md font-semibold text-blue-600 mb-2">Course: ${course}</h5>
					<table class="table table-bordered w-full text-sm border border-black mb-4">
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

			html += `<tr id="${summaryId}"><td colspan="5" class="text-center text-gray-500">Loading course summary...</td></tr>`;
			html += `</tbody></table></div>`;
		});

		$('#report_output').append(html);
		html = "";

		Object.entries(g.courses).forEach(([course]) => {
			frappe.call({
				method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_course_summary",
				args: {
					student: g.student,
					course: course,
					program: g.program,
					academic_year: g.academic_year
				},
				callback: function (res) {
					const sr = res.message || {};
					const summaryHtml = `
						<tr><td colspan="2"><b>COURSE SUMMARY</b></td><td></td><td></td><td></td></tr>
						<tr><td>COURSEWORK</td><td>20%</td><td>${sr.coursework?.[0] || 0}</td><td>${sr.coursework?.[1] || 0}</td><td>${sr.coursework?.[2] || 0}</td></tr>
						<tr><td>UNIT TEST</td><td>30%</td><td>${sr.unit_test?.[0] || 0}</td><td>${sr.unit_test?.[1] || 0}</td><td>${sr.unit_test?.[2] || 0}</td></tr>
						<tr><td>END OF TERM EXAM</td><td>50%</td><td>${sr.exam?.[0] || 0}</td><td>${sr.exam?.[1] || 0}</td><td>${sr.exam?.[2] || 0}</td></tr>
						<tr><td>TRIMESTER TOTAL</td><td>100%</td><td>${sr.trimester_total?.[0] || 0}</td><td>${sr.trimester_total?.[1] || 0}</td><td>${sr.trimester_total?.[2] || 0}</td></tr>
						<tr><td>YEARLY TOTAL GRADE</td><td colspan="4">${sr.yearly_average_mark || 0} ${sr.yearly_total_grade ? '(' + sr.yearly_total_grade + ')' : ''}</td></tr>
					`;
					$(`#summary_${g.student}_${course.replace(/\s+/g, '_')}`).replaceWith(summaryHtml);
				}
			});
		});

		// === Append overall summary & comments (once per student if student filter is applied)
		if (selectedStudent && !processed_students.has(g.student)) {
			processed_students.add(g.student);

			frappe.call({
				method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_overall_term_averages",
				args: {
					student: g.student,
					program: g.program,
					academic_year: g.academic_year
				},
				callback: function (res) {
					if (res.message) {
						const { term1_avg, term2_avg, term3_avg } = res.message;
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
									</tbody>
								</table>
							</div>`;
						$('#report_output').append(overall_html);

						// Fetch Term + Director comments
						frappe.call({
							method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_term_and_director_comments",
							args: {
								student: g.student,
								program: g.program,
								academic_year: g.academic_year
							},
							callback: function (r2) {
								if (r2.message) {
									const t = r2.message.teacher;
									const d = r2.message.director;
									const comments_html = `
										<div class="comments-section mt-6 border border-black rounded-lg p-4">
											<h4><b>Homeroom Teacher’s Comment / Commentaires du Titulaire :</b></h4>
											<p><b>T-1:</b> ${t.term1 || "......................................................................................................"}<br><br>
											<b>T-2:</b> ${t.term2 || "......................................................................................................"}<br><br>
											<b>T-3:</b> ${t.term3 || "......................................................................................................"}<br><br>
											<b>Name:</b> ${t.teacher_name || "..........................................."} &nbsp;&nbsp; <b>(Sign)</b> ...........................................
											<hr>
											<h4><b>Principal’s Note / Remarque du Directeur :</b></h4>
											<p><b>T1:</b> ${d.term1 || "......................................................................................................"}<br><br>
											<b>T2:</b> ${d.term2 || "......................................................................................................"}<br><br>
											<b>T3:</b> ${d.term3 || "......................................................................................................"}<br><br>
											<b>Name:</b> ${d.director_name || "..........................................."} &nbsp;&nbsp; <b>(Sign)</b> ...........................................
										</div>`;
									$('#report_output').append(comments_html);
								}
							}
						});
					}
				}
			});
		}
	});
}

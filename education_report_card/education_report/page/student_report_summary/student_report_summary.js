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

	// Add Print button below filters
	$('<button class="btn btn-primary mb-3">Print Report</button>')
		.insertAfter('.filter-card')  // <- moved here
		.on('click', function () {
			const reportContent = document.getElementById('report_output').innerHTML;

			if (!reportContent || reportContent.trim() === "" || reportContent.includes("No records found")) {
				frappe.msgprint("No records available to print.");
				return; // Stop further execution
			}

			let w = window.open('', '', 'height=700,width=900');
			w.document.write('<html><head><title>Student Report</title>');
			w.document.write('<style>');
			w.document.write('body { font-family: Arial, sans-serif; }');
			w.document.write('table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }');
			w.document.write('table, th, td { border: 1px solid black; }');
			w.document.write('th, td { padding: 8px; text-align: left; }');
			w.document.write('.student-report-card { margin-bottom: 20px; border: 1px solid black; padding: 10px; }');
			w.document.write('</style>');
			w.document.write('</head><body>');
			w.document.write(reportContent);
			w.document.write('</body></html>');
			w.document.close();
			w.print();
		});
};

// Load dropdowns dynamically
function load_filters() {
	frappe.db.get_list('Program', { fields: ['name'] }).then(res => {
		res.forEach(r => $('#program').append(`<option>${r.name}</option>`));
	});

	frappe.db.get_list('Academic Term', { fields: ['name', 'academic_year'] }).then(res => {
		res.forEach(r => $('#term').append(`<option value="${r.name}">${r.name}</option>`));
	});

	frappe.db.get_list('Course', { fields: ['name'] }).then(res => {
		res.forEach(r => $('#course').append(`<option>${r.name}</option>`));
	});

	frappe.db.get_list('Student', { fields: ['name', 'student_name'] }).then(res => {
		res.forEach(r => $('#student').append(`<option value="${r.name}">${r.student_name}</option>`));
	});
}

// Load and render reports
function load_reports() {
	const filters = {
		program: $('#program').val() || null,
		term: $('#term').val() || null,
		course: $('#course').val() || null,
		student: $('#student').val() || null
	};

	frappe.call({
		method: "education_report_card.education_report.page.student_report_summary.student_report_summary.get_student_reports",
		args: { filters },
		callback: function (r) {
			if (!r.message || r.message.length === 0) {
				$('#report_output').html("<p class='text-muted'>No records found.</p>");
				return;
			}

			render_reports(r.message);
		}
	});
}

// Render reports grouped by Academic Year → Program → Student → Course
function render_reports(data) {
	let html = "";

	const grouped = {};

	data.forEach(row => {
		const term = row.term || "Unknown Term";
		const academic_year = row.academic_year || row.term_academic_year || "Unknown Academic Year";
		const program = row.program || "Unknown Program";
		const student = row.student || "Unknown Student";
		const student_name = row.student_name ? ` (${row.student_name})` : "";
		const course = row.course || "Unknown Course";

		const key = `${academic_year}_${program}_${term}_${student}_${course}`;

		if (!grouped[key]) {
			grouped[key] = {
				academic_year,
				program,
				term,
				student,
				student_name,
				courses: { [course]: { topics: {} } }
			};
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

	Object.values(grouped).forEach(g => {
		Object.entries(g.courses).forEach(([course, courseData]) => {
			html += `
				<div class="student-report-card bg-white shadow-md rounded-lg p-4 mb-6 border border-black">
					<div class="flex flex-wrap justify-between text-sm text-gray-700 mb-3">
						<div><b>Academic Year:</b> ${g.academic_year}</div>
						<div><b>Program/Grade:</b> ${g.program}</div>
						<div><b>Term:</b> ${g.term}</div>
						<div><b>Student:</b> ${g.student}${g.student_name}</div>
					</div>
					<h5 class="text-md font-semibold text-blue-600 mb-2">Course: ${course}</h5>
					<table class="table table-bordered w-full text-sm border border-black mb-4">
						<thead class="bg-gray-100 border border-black">
							<tr>
								<th class="border border-black">Topic Name</th>
								<th class="border border-black">Competency</th>
								<th class="border border-black">Term 1</th>
								<th class="border border-black">Term 2</th>
								<th class="border border-black">Term 3</th>
							</tr>
						</thead>
						<tbody>
			`;

			// Render topics with rowspan
			Object.entries(courseData.topics).forEach(([topic, comps]) => {
				comps.forEach((c, idx) => {
					html += `
						<tr>
							${idx === 0 ? `<td rowspan="${comps.length}" class="font-medium border border-black">${topic}</td>` : ""}
							<td class="border border-black">${c.competency || ""}</td>
							<td class="border border-black">${c.term1 || ""}</td>
							<td class="border border-black">${c.term2 || ""}</td>
							<td class="border border-black">${c.term3 || ""}</td>
						</tr>
					`;
				});
			});

			// ===== Course Summary with zeros =====
			let testTypes = ["Coursework", "Unit Test", "Exam"];
			html += `<tr><td colspan="2"><b>COURSE SUMMARY</b></td><td></td><td></td><td></td></tr>`;
			testTypes.forEach(tt => {
				html += `<tr>
					<td>${tt.toUpperCase()}</td>
					<td>0%</td>
					<td>0</td>
					<td>0</td>
					<td>0</td>
				</tr>`;
			});
			html += `<tr><td>TRIMESTER TOTAL</td><td>100%</td><td colspan="3">0</td></tr>`;
			html += `<tr><td>YEARLY TOTAL GRADE</td><td colspan="4">0</td></tr>`;

			html += `</tbody></table></div>`;
		});
	});

	$('#report_output').html(html);
}

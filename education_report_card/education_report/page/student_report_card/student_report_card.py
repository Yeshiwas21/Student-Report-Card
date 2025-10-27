import frappe

@frappe.whitelist()
def get_student_reports(filters):
    filters = frappe.parse_json(filters or {})
    conditions = []
    values = {}

    if filters.get("program"):
        conditions.append("sr.program = %(program)s")
        values["program"] = filters["program"]
    if filters.get("academic_year"):
        conditions.append("sr.academic_year = %(academic_year)s")
        values["academic_year"] = filters["academic_year"]
    if filters.get("course"):
        conditions.append("sr.course = %(course)s")
        values["course"] = filters["course"]
    if filters.get("student"):
        conditions.append("sr.student = %(student)s")
        values["student"] = filters["student"]

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    data = frappe.db.sql(f"""
        SELECT
            sr.student,
            sr.student_name,
            sr.program,
            sr.course,
            sr.academic_year,
            srd.topic_name,
            srd.competency,
            srd.term1,
            srd.term2,
            srd.term3
        FROM `tabStudent Report` sr
        LEFT JOIN `tabStudent Report Detail` srd ON srd.parent = sr.name
        WHERE {where_clause}
        ORDER BY sr.student, sr.course, srd.topic_name, srd.idx
    """, values, as_dict=True)

    return data

@frappe.whitelist()
def get_course_summary(student, course, program, academic_year):
    conditions = {
        "student": student,
        "course": course,
        "program": program,
        "academic_year": academic_year
    }

    # Prefer draft first
    report = frappe.db.get_value(
        "Student Report",
        {**conditions, "docstatus": 0},
        [
            "coursework_term1_20_percent", "coursework_term2_20_percent", "coursework_term3_20_percent",
            "unit_test_term1_30_percent", "unit_test_term2_30_percent", "unit_test_term3_30_percent",
            "exam_term1_50_percent", "exam_term2_50_percent", "exam_term3_50_percent",
            "term1_total", "term2_total", "term3_total",
            "yearly_average_mark", "yearly_total_grade"
        ],
        as_dict=True
    )

    # Fallback to submitted
    if not report:
        report = frappe.db.get_value(
            "Student Report",
            {**conditions, "docstatus": 1},
            [
                "coursework_term1_20_percent", "coursework_term2_20_percent", "coursework_term3_20_percent",
                "unit_test_term1_30_percent", "unit_test_term2_30_percent", "unit_test_term3_30_percent",
                "exam_term1_50_percent", "exam_term2_50_percent", "exam_term3_50_percent",
                "term1_total", "term2_total", "term3_total",
                "yearly_average_mark", "yearly_total_grade"
            ],
            as_dict=True
        )

    if not report:
        return {
            "coursework": [0, 0, 0],
            "unit_test": [0, 0, 0],
            "exam": [0, 0, 0],
            "trimester_total": [0, 0, 0],
            "yearly_average_mark": 0,
            "yearly_total_grade": ""
        }

    return {
        "coursework": [
            report.get("coursework_term1_20_percent") or 0,
            report.get("coursework_term2_20_percent") or 0,
            report.get("coursework_term3_20_percent") or 0
        ],
        "unit_test": [
            report.get("unit_test_term1_30_percent") or 0,
            report.get("unit_test_term2_30_percent") or 0,
            report.get("unit_test_term3_30_percent") or 0
        ],
        "exam": [
            report.get("exam_term1_50_percent") or 0,
            report.get("exam_term2_50_percent") or 0,
            report.get("exam_term3_50_percent") or 0
        ],
        "trimester_total": [
            report.get("term1_total") or 0,
            report.get("term2_total") or 0,
            report.get("term3_total") or 0
        ],
        "yearly_average_mark": report.get("yearly_average_mark") or 0,
        "yearly_total_grade": report.get("yearly_total_grade") or ""
    }

@frappe.whitelist()
def get_overall_term_averages(student, academic_year, program):
    if not student or not academic_year or not program:
        return {"term1_avg": 0, "term2_avg": 0, "term3_avg": 0}

    res = frappe.db.sql("""
        SELECT
            AVG(COALESCE(term1_total, 0)) AS term1_avg,
            AVG(COALESCE(term2_total, 0)) AS term2_avg,
            AVG(COALESCE(term3_total, 0)) AS term3_avg
        FROM `tabStudent Report`
        WHERE student = %s
          AND academic_year = %s
          AND program = %s
    """, (student, academic_year, program), as_dict=True)

    row = res[0] if res else {}
    return {
        "term1_avg": round(row.get("term1_avg") or 0, 2),
        "term2_avg": round(row.get("term2_avg") or 0, 2),
        "term3_avg": round(row.get("term3_avg") or 0, 2),
    }

@frappe.whitelist()
def get_term_and_director_comments(student, program, academic_year):
    comments = {
        "teacher": {"term1": "", "term2": "", "term3": "", "teacher_name": ""},
        "director": {"term1": "", "term2": "", "term3": "", "director_name": ""}
    }

    term_comment = frappe.db.get_value(
        "Term Comment",
        {"student": student, "program": program, "academic_year": academic_year},
        ["term1_comment", "term2_comment", "term3_comment", "teacher_name"],
        as_dict=True
    )
    if term_comment:
        comments["teacher"].update({
            "term1": term_comment.term1_comment or "",
            "term2": term_comment.term2_comment or "",
            "term3": term_comment.term3_comment or "",
            "teacher_name": term_comment.teacher_name or ""
        })

    director_msg = frappe.db.get_value(
        "Director Message",
        {"academic_year": academic_year, "program": program},
        ["term1_comment", "term2_comment", "term3_comment", "director_name"],
        as_dict=True
    )
    if director_msg:
        comments["director"].update({
            "term1": director_msg.term1_comment or "",
            "term2": director_msg.term2_comment or "",
            "term3": director_msg.term3_comment or "",
            "director_name": director_msg.director_name or ""
        })

    return comments

@frappe.whitelist()
def get_director_message(academic_year, program):
    director_message = frappe.db.get_value(
        "Director Message",
        {"academic_year": academic_year, "program": program},
        ["director_name", "introduction_france", "introduction_english", "conclusion_fr", "conc_title_fr", "conc_title_en", "conclusion_en", "company"],
        as_dict=True
    )
    return director_message or {}



@frappe.whitelist()
def get_student_report_summary(academic_year, program, student=None, full=False):
    """
    Fetch student report summary.
    If `full=True`, returns detailed course, competency, and comments data.
    Otherwise returns compact summary view.
    """
    conditions = ""
    if student:
        conditions += f" AND sr.student = '{student}'"
    if program:
        conditions += f" AND sr.program = '{program}'"
    if academic_year:
        conditions += f" AND sr.academic_year = '{academic_year}'"

    # === Compact data for summary view ===
    summary_query = f"""
        SELECT
            sr.course AS course_name,
            sr.trimester_total,
            sr.yearly_total_grade
        FROM
            `tabStudent Report` sr
        WHERE
            1=1 {conditions}
        ORDER BY sr.course
    """
    summary_data = frappe.db.sql(summary_query, as_dict=True)

    # === If not full, return summary ===
    if not full:
        return summary_data

    # === Full detailed report ===
    detailed_data = []
    courses = frappe.db.sql(f"""
        SELECT DISTINCT sr.course, sr.course_name
        FROM `tabStudent Report` sr
        WHERE 1=1 {conditions}
        ORDER BY sr.course_name
    """, as_dict=True)

    for course in courses:
        course_name = course.course_name or course.course

        competencies = frappe.db.sql(f"""
            SELECT
                c.competency AS name,
                c.term1, c.term2, c.term3, c.total
            FROM `tabStudent Competency` c
            INNER JOIN `tabStudent Report` sr ON sr.name = c.parent
            WHERE sr.course = %s {conditions}
        """, (course_name,), as_dict=True)

        course_summary = frappe.db.get_value(
            "Student Report",
            {"course": course_name, "program": program, "academic_year": academic_year, "student": student},
            "course_summary"
        )

        detailed_data.append({
            "course_name": course_name,
            "competencies": competencies,
            "course_summary": course_summary,
            "trimester_total": frappe.db.get_value(
                "Student Report",
                {"course": course_name, "program": program, "academic_year": academic_year, "student": student},
                "trimester_total"
            ),
            "yearly_total_grade": frappe.db.get_value(
                "Student Report",
                {"course": course_name, "program": program, "academic_year": academic_year, "student": student},
                "yearly_total_grade"
            ),
        })

    # === Add comments and overall averages ===
    teacher_comment = frappe.db.get_value("Teacher Comment", {"student": student, "academic_year": academic_year}, "comment")
    director_comment = frappe.db.get_value("Director Comment", {"student": student, "academic_year": academic_year}, "comment")
    director_conclusion_fr = frappe.db.get_value("Director Comment", {"student": student, "academic_year": academic_year}, "conclusion_fr")
    director_conclusion_en = frappe.db.get_value("Director Comment", {"student": student, "academic_year": academic_year}, "conclusion_en")

    overall_averages = frappe.db.sql(f"""
        SELECT
            AVG(term1_avg) AS term1_avg,
            AVG(term2_avg) AS term2_avg,
            AVG(term3_avg) AS term3_avg,
            AVG(yearly_avg) AS yearly_avg
        FROM `tabStudent Report`
        WHERE 1=1 {conditions}
    """, as_dict=True)

    # Merge metadata to the first entry
    if detailed_data:
        detailed_data[0].update({
            "teacher_comment": teacher_comment,
            "director_comment": director_comment,
            "director_conclusion_fr": director_conclusion_fr,
            "director_conclusion_en": director_conclusion_en,
            "term1_avg": overall_averages[0].term1_avg if overall_averages else None,
            "term2_avg": overall_averages[0].term2_avg if overall_averages else None,
            "term3_avg": overall_averages[0].term3_avg if overall_averages else None,
            "yearly_avg": overall_averages[0].yearly_avg if overall_averages else None,
        })

    return detailed_data

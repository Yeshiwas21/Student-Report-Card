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
    """
    Fetch pre-calculated COURSE SUMMARY fields from Student Report.
    Parameters:
      - student (name)
      - course (name)
      - program (name)
      - academic_year (name)
    Returns JSON object with arrays for coursework, unit_test, exam and trimester_total.
    """
    # Try to fetch a draft (docstatus=0) Student Report first, then submitted (1) if not found
    conditions = {
        "student": student,
        "course": course,
        "program": program,
        "academic_year": academic_year
    }

    # Prefer draft (docstatus = 0)
    report = frappe.db.get_value(
        "Student Report",
        {**conditions, "docstatus": 0},
        [
            "coursework_term1_20_percent",
            "coursework_term2_20_percent",
            "coursework_term3_20_percent",
            "unit_test_term1_30_percent",
            "unit_test_term2_30_percent",
            "unit_test_term3_30_percent",
            "exam_term1_50_percent",
            "exam_term2_50_percent",
            "exam_term3_50_percent",
            "term1_total",
            "term2_total",
            "term3_total",
            "yearly_average_mark",
            "yearly_total_grade"
        ],
        as_dict=True
    )

    # Fallback to submitted if no draft found
    if not report:
        report = frappe.db.get_value(
            "Student Report",
            {**conditions, "docstatus": 1},
            [
                "coursework_term1_20_percent",
                "coursework_term2_20_percent",
                "coursework_term3_20_percent",
                "unit_test_term1_30_percent",
                "unit_test_term2_30_percent",
                "unit_test_term3_30_percent",
                "exam_term1_50_percent",
                "exam_term2_50_percent",
                "exam_term3_50_percent",
                "term1_total",
                "term2_total",
                "term3_total",
                "yearly_average_mark",
                "yearly_total_grade"
            ],
            as_dict=True
        )

    # If still not found, return zeros to avoid JS errors
    if not report:
        return {
            "coursework": [0, 0, 0],
            "unit_test": [0, 0, 0],
            "exam": [0, 0, 0],
            "trimester_total": [0, 0, 0],
            "yearly_average_mark": 0,
            "yearly_total_grade": ""
        }

    # Build response arrays
    coursework = [
        report.get("coursework_term1_20_percent") or 0,
        report.get("coursework_term2_20_percent") or 0,
        report.get("coursework_term3_20_percent") or 0
    ]
    unit_test = [
        report.get("unit_test_term1_30_percent") or 0,
        report.get("unit_test_term2_30_percent") or 0,
        report.get("unit_test_term3_30_percent") or 0
    ]
    exam = [
        report.get("exam_term1_50_percent") or 0,
        report.get("exam_term2_50_percent") or 0,
        report.get("exam_term3_50_percent") or 0
    ]
    trimester_total = [
        report.get("term1_total") or 0,
        report.get("term2_total") or 0,
        report.get("term3_total") or 0
    ]

    return {
        "coursework": coursework,
        "unit_test": unit_test,
        "exam": exam,
        "trimester_total": trimester_total,
        "yearly_average_mark": report.get("yearly_average_mark") or 0,
        "yearly_total_grade": report.get("yearly_total_grade") or ""
    }


@frappe.whitelist()
def get_overall_term_averages(student, academic_year, program):
    """
    Return the average Term1, Term2, and Term3 totals across all Student Reports
    for a specific student, academic year, and program.
    """
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
    """Fetch both teacher (Term Comment) and director messages for the student and academic year."""
    comments = {
        "teacher": {"term1": "", "term2": "", "term3": "", "teacher_name": ""},
        "director": {"term1": "", "term2": "", "term3": "", "director_name": ""}
    }

    # === Fetch teacher (Term Comment) ===
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

    # === Fetch director message ===
    director_msg = frappe.db.get_value(
        "Director Message",
        {"academic_year": academic_year},
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

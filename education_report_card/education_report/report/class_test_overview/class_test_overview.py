import frappe

def execute(filters=None):
    filters = filters or {}

    # ✅ Mandatory filter check
    if not filters.get("academic_year"):
        frappe.throw("Please select an Academic Year")

    # ---------------------------
    # 🔍 Build SQL Conditions
    # ---------------------------
    conditions = ["tr.academic_year = %(academic_year)s"]
    params = {"academic_year": filters["academic_year"]}

    # Optional filters
    for key in ["program", "course", "term", "test_type", "student", "teacher"]:
        if filters.get(key):
            if key == "student":
                conditions.append("trd.student = %({})s".format(key))
            else:
                conditions.append("tr.{} = %({})s".format(key, key))
            params[key] = filters[key]

    condition_str = " AND ".join(conditions)

    # ---------------------------
    # 1️⃣ Detailed Data
    # ---------------------------
    detailed_data = frappe.db.sql(f"""
        SELECT
            tr.name AS test_result_id,
            tr.program,
            tr.course,
            tr.term,
            tr.test_type,
            tr.possible_mark,
            trd.student,
            trd.student_name,
            trd.mark_earned,
            tr.test_date
        FROM `tabTest Result` tr
        JOIN `tabTest Result Detail` trd ON trd.parent = tr.name
        WHERE {condition_str}
        ORDER BY tr.course, tr.test_date, trd.student_name
    """, params, as_dict=True)

    # ---------------------------
    # 2️⃣ Summary (Averages per grouping)
    # ---------------------------
    summary_data = frappe.db.sql(f"""
        SELECT
            tr.program,
            tr.course,
            tr.term,
            tr.test_type,
            ROUND(AVG(tr.possible_mark), 2) AS possible_mark,
            ROUND(AVG(trd.mark_earned), 2) AS average_mark,
            ROUND(AVG((trd.mark_earned / tr.possible_mark) * 100), 2) AS avg_percentage,
            COUNT(DISTINCT trd.student) AS total_students
        FROM `tabTest Result` tr
        JOIN `tabTest Result Detail` trd ON trd.parent = tr.name
        WHERE {condition_str}
        GROUP BY tr.program, tr.course, tr.term, tr.test_type
        ORDER BY tr.program, tr.course
    """, params, as_dict=True)

    # ---------------------------
    # 3️⃣ Define Columns
    # ---------------------------
    columns = [
        {"label": "Test Result ID", "fieldname": "test_result_id", "fieldtype": "Link", "options": "Test Result", "width": 160},
        {"label": "Program/Grade", "fieldname": "program", "fieldtype": "Link", "options": "Program", "width": 140},
        {"label": "Course/Subject", "fieldname": "course", "fieldtype": "Link", "options": "Course", "width": 160},
        {"label": "Term", "fieldname": "term", "fieldtype": "Data", "width": 90},
        {"label": "Test Type", "fieldname": "test_type", "fieldtype": "Data", "width": 110},
        {"label": "Student", "fieldname": "student", "fieldtype": "Link", "options": "Student", "width": 150},
        {"label": "Student Name", "fieldname": "student_name", "fieldtype": "Data", "width": 180},
        {"label": "Mark Earned", "fieldname": "mark_earned", "fieldtype": "Float", "width": 110},
        {"label": "Possible Mark", "fieldname": "possible_mark", "fieldtype": "Float", "width": 120},
        {"label": "Test Date", "fieldname": "test_date", "fieldtype": "Date", "width": 120},
    ]

    # ---------------------------
    # 4️⃣ Append Summary Section
    # ---------------------------
    if summary_data:
        detailed_data.append({})
        # Visual "colspan" effect
        detailed_data.append({
            "student_name": "<b>📊 Averages (Grouped Summary)</b>",
            "test_result_id": "",
            "program": "",
            "course": "",
            "term": "",
            "test_type": "",
            "student": "",
            "mark_earned": "",
            "possible_mark": "",
            "test_date": ""
        })

        for row in summary_data:
            detailed_data.append({
                "program": row.program,
                "course": row.course,
                "term": row.term,
                "test_type": row.test_type,
                "student_name": f"Average of {row.total_students} Students",
                "mark_earned": row.average_mark,
                "possible_mark": row.possible_mark,
                "test_date": "",
            })

    # ---------------------------
    # 5️⃣ Return
    # ---------------------------
    return columns, detailed_data

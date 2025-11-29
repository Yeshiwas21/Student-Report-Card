import frappe

def execute(filters=None):
    filters = filters or {}

    # ✅ Mandatory filter check
    if not filters.get("academic_year"):
        frappe.throw("Please select an Academic Year")

    conditions = [f"tr.academic_year = '{filters['academic_year']}'"]  # Always include

    # Optional filters
    if filters.get("program"):
        conditions.append(f"tr.program = '{filters['program']}'")
    if filters.get("course"):
        conditions.append(f"tr.course = '{filters['course']}'")
    if filters.get("term"):
        conditions.append(f"tr.term = '{filters['term']}'")
    if filters.get("test_type"):
        conditions.append(f"tr.test_type = '{filters['test_type']}'")
    if filters.get("student"):
        conditions.append(f"trd.student = '{filters['student']}'")
    if filters.get("teacher"):
        conditions.append(f"tr.teacher = '{filters['teacher']}'")

    condition_str = " and ".join(conditions) if conditions else "1=1"

    data = frappe.db.sql(f"""
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
        FROM
            `tabTest Result` tr
        JOIN
            `tabTest Result Detail` trd ON trd.parent = tr.name
        WHERE
            {condition_str}
        ORDER BY
            tr.course, tr.test_date, trd.student_name
    """, as_dict=True)

    # 🧱 Define columns with proper widths
    columns = [
        {"label": "Test Result ID", "fieldname": "test_result_id", "fieldtype": "Link", "options": "Test Result", "width": 180},
        {"label": "Program/Grade", "fieldname": "program", "fieldtype": "Link", "options": "Program", "width": 140},
        {"label": "Course/Subject", "fieldname": "course", "fieldtype": "Link", "options": "Course", "width": 180},
        {"label": "Term", "fieldname": "term", "fieldtype": "Data", "width": 90},
        {"label": "Test Type", "fieldname": "test_type", "fieldtype": "Data", "width": 110},
        {"label": "Student", "fieldname": "student", "fieldtype": "Link", "options": "Student", "width": 160},
        {"label": "Student Name", "fieldname": "student_name", "fieldtype": "Data", "width": 180},
        {"label": "Mark Earned", "fieldname": "mark_earned", "fieldtype": "Float", "width": 110},
        {"label": "Possible Mark", "fieldname": "possible_mark", "fieldtype": "Float", "width": 120},
        {"label": "Test Date", "fieldname": "test_date", "fieldtype": "Date", "width": 120},
    ]

    return columns, data

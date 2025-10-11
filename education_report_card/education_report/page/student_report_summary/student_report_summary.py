import frappe

@frappe.whitelist()
def get_student_reports(filters):
    filters = frappe.parse_json(filters or {})
    conditions = []
    values = {}

    if filters.get("program"):
        conditions.append("sr.program = %(program)s")
        values["program"] = filters["program"]
    if filters.get("term"):
        conditions.append("sr.term = %(term)s")
        values["term"] = filters["term"]
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
            sr.term,
            at.academic_year,
            srd.topic_name,
            srd.competency,
            srd.term1,
            srd.term2,
            srd.term3
        FROM `tabStudent Report` sr
        LEFT JOIN `tabStudent Report Detail` srd ON srd.parent = sr.name
        LEFT JOIN `tabAcademic Term` at ON at.name = sr.term
        WHERE {where_clause}
        ORDER BY sr.student, sr.course, srd.topic_name, srd.idx
    """, values, as_dict=True)

    return data

import frappe
import json

def execute():
    """
    Patch to merge workspace fixture contents into existing workspaces without overwriting.
    Compatible with Frappe v14 and v15.
    """
    fixture_path = frappe.get_app_path("education_report_card", "fixtures", "workspace.json")

    try:
        with open(fixture_path, "r", encoding="utf-8") as f:
            workspaces = json.load(f)
    except Exception as e:
        print(f"❌ Could not read fixture file: {fixture_path}")
        print(str(e))
        return

    for ws_data in workspaces:
        workspace_name = ws_data.get("name")
        if not workspace_name:
            continue

        # Try loading existing workspace
        try:
            workspace = frappe.get_doc("Workspace", workspace_name)
            print(f"🔄 Updating existing workspace: {workspace_name}")
        except frappe.DoesNotExistError:
            print(f"🆕 Creating new workspace: {workspace_name}")
            workspace = frappe.get_doc(ws_data)
            workspace.insert(ignore_permissions=True)
            continue

        # --- Merge Links ---
        existing_links = {
            (l.label, l.link_type, l.link_to)
            for l in getattr(workspace, "links", [])
        }
        added_links = 0
        for link in ws_data.get("links", []):
            key = (link.get("label"), link.get("link_type"), link.get("link_to"))
            if key not in existing_links:
                workspace.append("links", link)
                added_links += 1

        # --- Merge Shortcuts ---
        existing_shortcuts = {s.label for s in getattr(workspace, "shortcuts", [])}
        added_shortcuts = 0
        for sc in ws_data.get("shortcuts", []):
            if sc.get("label") not in existing_shortcuts:
                workspace.append("shortcuts", sc)
                added_shortcuts += 1

        # --- Merge Charts / Dashboards ---
        existing_charts = {c.label for c in getattr(workspace, "charts", [])}
        added_charts = 0
        # Support older "dashboards" key in fixture
        for chart in ws_data.get("charts", ws_data.get("dashboards", [])):
            if chart.get("label") not in existing_charts:
                workspace.append("charts", chart)
                added_charts += 1

        # --- Merge Number Cards ---
        existing_number_cards = {n.label for n in getattr(workspace, "number_cards", [])}
        added_number_cards = 0
        for nc in ws_data.get("number_cards", []):
            if nc.get("label") not in existing_number_cards:
                workspace.append("number_cards", nc)
                added_number_cards += 1

        # --- Merge Quick Lists ---
        existing_quick_lists = {q.label for q in getattr(workspace, "quick_lists", [])}
        added_quick_lists = 0
        for ql in ws_data.get("quick_lists", []):
            if ql.get("label") not in existing_quick_lists:
                workspace.append("quick_lists", ql)
                added_quick_lists += 1

        # --- Merge Custom Blocks ---
        existing_blocks = {b.label for b in getattr(workspace, "custom_blocks", [])}
        added_blocks = 0
        for block in ws_data.get("custom_blocks", ws_data.get("blocks", [])):
            if block.get("label") not in existing_blocks:
                workspace.append("custom_blocks", block)
                added_blocks += 1

        # --- Merge Roles ---
        existing_roles = {r.role for r in getattr(workspace, "roles", [])}
        added_roles = 0
        for role in ws_data.get("roles", []):
            if role.get("role") not in existing_roles:
                workspace.append("roles", role)
                added_roles += 1

        # Save workspace
        workspace.save(ignore_permissions=True)
        print(
            f"✅ Updated '{workspace_name}': "
            f"{added_links} links, {added_shortcuts} shortcuts, {added_charts} charts, "
            f"{added_number_cards} number cards, {added_quick_lists} quick lists, "
            f"{added_blocks} custom blocks, {added_roles} roles added."
        )

    print("🎉 Workspace synchronization completed successfully.")

import frappe
import json

def execute():
    """
    Patch to merge workspace fixture contents into existing workspaces without overwriting.
    Uses print() to show messages in the terminal during migration.
    """
    # Path to your fixture
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

        # Load existing Workspace
        try:
            workspace = frappe.get_doc("Workspace", workspace_name)
            print(f"Processing Workspace: {workspace_name}")
        except frappe.DoesNotExistError:
            print(f"❌ Workspace '{workspace_name}' does not exist, skipping.")
            continue

        # Add links if they don't exist
        added_links = 0
        for link in ws_data.get("links", []):
            if not any(l.label == link["label"] and l.link_type == link["link_type"] and l.link_to == link["link_to"] for l in workspace.links):
                workspace.append("links", link)
                added_links += 1

        # Add cards if they don't exist
        added_cards = 0
        for card in ws_data.get("cards", []):
            if not any(c.label == card["label"] for c in workspace.cards):
                workspace.append("cards", card)
                added_cards += 1

        # Add custom blocks if they don't exist
        added_blocks = 0
        for block in ws_data.get("blocks", []):
            if not any(b.label == block["label"] for b in workspace.blocks):
                workspace.append("blocks", block)
                added_blocks += 1

        workspace.save(ignore_permissions=True)
        print(f"✅ Added {added_links} links, {added_cards} cards, {added_blocks} blocks to '{workspace_name}'.")

    print("🎉 Workspace fixture synchronization completed successfully.")

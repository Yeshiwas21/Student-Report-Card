frappe.listview_settings['Student Report'] = {

    onload(listview) {
        console.log("Student Report listview loaded!");

        listview.page.add_inner_button(__('View Summary'), () => {

            // Navigate to your custom summary page
            frappe.set_route('student-report-summary');
        });
    }
};

frappe.listview_settings['Test Result'] = {
    add_fields: [
        'test_date',
        'academic_year',
        'program',
        'course',
        'term',
        'test_type',
        'teacher',
        'instructor_name',
        'possible_mark',
        'modified'
    ],

    // Define the columns shown in the list view
    get_fields: function () {
        return [
            { label: 'Test Date', fieldname: 'test_date', fieldtype: 'Date', width: '100px' },
            { label: 'Academic Year', fieldname: 'academic_year', fieldtype: 'Link', options: 'Academic Year', width: '120px' },
            { label: 'Program/Grade', fieldname: 'program', fieldtype: 'Link', options: 'Program', width: '120px' },
            { label: 'Course/Subject', fieldname: 'course', fieldtype: 'Link', options: 'Course', width: '120px' },
            { label: 'Term', fieldname: 'term', fieldtype: 'Select', width: '80px' },
            { label: 'Test Type', fieldname: 'test_type', fieldtype: 'Select', width: '100px' },
            { label: 'Teacher', fieldname: 'teacher', fieldtype: 'Link', options: 'Instructor', width: '120px' },
            { label: 'Instructor Name', fieldname: 'instructor_name', fieldtype: 'Data', width: '150px' },
            { label: 'Possible Mark', fieldname: 'possible_mark', fieldtype: 'Float', width: '100px' },
            { label: 'Modified', fieldname: 'modified', fieldtype: 'Datetime', width: '140px' },
        ];
    }
};

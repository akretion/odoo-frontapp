# Copyright 2021 Akretion
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

{
    "name": "Frontapp Plugin",
    "description": """
        Plugin for FrontApp CRM""",
    "version": "14.0.1.0.0",
    "license": "LGPL-3",
    "author": "Akretion",
    "website": "https://github.com/akretion/odoo-frontapp",
    "depends": ["crm"],
    "data": [
        "data/mail_data.xml",
        "views/assets_template.xml",
        "views/frontapp_template.xml",
    ],
    "demo": [],
}

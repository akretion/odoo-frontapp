# Copyright 2021 Akretion
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

{
    "name": "Frontapp Plugin",
    "summary": """
        Plugin for FrontApp CRM""",
    "version": "14.0.1.0.0",
    "license": "LGPL-3",
    "authors": "Akretion, Odoo Community Association (OCA)",
    "website": "https://github.com/akretion/odoo-frontapp",
    "depends": ["crm"],
    "maintainers": ["rvalyi"],
    "data": [
        "data/mail_data.xml",
        "views/assets_template.xml",
        "views/frontapp_template.xml",
    ],
    "demo": [],
}

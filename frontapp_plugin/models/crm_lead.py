from odoo import fields, models


class MailMessage(models.Model):
    _inherit = "crm.lead"

    created_from_frontapp = fields.Boolean()
    # TODO FrontApp m2m related links
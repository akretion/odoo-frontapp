from odoo import fields, models


class MailMessage(models.Model):
    _inherit = 'mail.message'

    frontapp_conversation_key = fields.Char(index=True)

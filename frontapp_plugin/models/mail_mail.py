from odoo import fields, models


class MailMail(models.Model):
    _inherit = 'mail.mail'

    def _send(self, auto_commit=False, raise_exception=False, smtp_session=None):
        """
        mail#send is called after commit() and this is when the subject is
        finally set. When object is res.partner and subtype is Note,
        add an id to the mail subject so FrontApp won't mix notes.
        """
        for mail_id in self.ids:
            try:  # same try as in super()
                mail = self.browse(mail_id)
                if (
                    mail.mail_message_id.model == "res.partner"
                    and mail.mail_message_id.subtype_id
                    and mail.mail_message_id.subtype_id.name == "Note"
                ):
                    mail.subject += " #%s" % (mail.id,)
            except Exception as e:
                pass
        return super()._send(auto_commit=False, raise_exception=False, smtp_session=None)
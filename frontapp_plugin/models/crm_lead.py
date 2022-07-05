from odoo import fields, models


class MailMessage(models.Model):
    _inherit = "crm.lead"

    created_from_frontapp = fields.Boolean()
    # TODO FrontApp m2m related links

    def toggle_opportunity_link(self, is_linked, frontapp_context):
        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        conversation_key = frontapp_context["conversation"].get("id", "no_conversation")
        subject = frontapp_context["conversation"].get("subject", "no subject")
        blurb = frontapp_context["conversation"].get("blurb", "no description")
        for lead in self:
            existing_links = self.partner_id._frontapp_conversations(
                "crm.lead", [lead.id], conversation_key
            )[0]
            if is_linked:
                if not existing_links:
                    body = """
                    <h3>%s</h3><a class="frontapp_conversation_link" target="_blank"
                    href="https://app.frontapp.com/open/%s">%s...</a><br/>
                    <a href="/web#model=res.partner&amp;id=%s" class="o_mail_redirect"
                    data-oe-id="%s" data-oe-model="res.partner"
                    target="_blank">@%s</a>
                    """ % (
                        subject,
                        conversation_key,
                        blurb,
                        self.env.user.partner_id.id,
                        self.env.user.partner_id.id,
                        self.env.user.name,
                    )
                    message = lead.message_post(
                        subject=subject,
                        body=body,
                        subtype_xmlid="frontapp_plugin.frontapp_conversation_link",
                    )
                    message.frontapp_conversation_key = conversation_key
            else:
                existing_links.unlink()
        return True


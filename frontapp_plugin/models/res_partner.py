from odoo import api, models

PARTNER_LIMIT = 10
LEAD_LIMIT = 5
LAST_CONVERSATIONS_COUNT = 3

class ResPartner(models.Model):
    _inherit = "res.partner"

    @api.model
    def _get_frontapp_partner_fields(self):
        return [
            "name",
            "category_id",
            "phone",
            "mobile",
            "company_id",
            "function",
            "zip",
            "city",
            "country_id",
            "user_id",
            "opportunity_ids",
            "parent_id",
            "category_id",
            "country_id",
            "user_id",
            "company_type",
        ]

    @api.model
    def _get_frontapp_lead_fields(self):
        return []

    @api.model
    def _search_frontapp_partners(
        self, contact_emails, search_param, linked_partner_ids, domain=None
    ):
        if not domain:
            if search_param:
                domain = [
                    "|",
                    "|",
                    ("email", "ilike", search_param),
                    ("name", "ilike", search_param),
                    ("id", "in", linked_partner_ids),
                ]
            else:
                domain = [
                    "|",
                    ("email", "in", contact_emails),
                    ("id", "in", linked_partner_ids),
                ]
        return super().search_read(
            domain,
            fields=self._get_frontapp_partner_fields(),
            offset=0,
            limit=PARTNER_LIMIT,
            order="write_date DESC",
        )

    @api.model
    def search_from_frontapp(self, contact_emails, search_param, frontapp_context):
        odoo_server = self.env["ir.config_parameter"].sudo().get_param("web.base.url")
        odoo_partner_action = self.env.ref("base.action_partner_form").id
        odoo_partner_menu = self.env.ref("crm.res_partner_menu_customer").id
        odoo_lead_action = self.env.ref("crm.crm_lead_action_pipeline").id
        odoo_lead_menu = self.env.ref("crm.crm_menu_leads").id

        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        conversation_key = frontapp_context["conversation"].get("id", "no_conversation")
        links = self._frontapp_conversations([], conversation_key)[0]
        linked_partner_ids = [link.res_id for link in links]

        partner_records = self._search_frontapp_partners(
            contact_emails, search_param, linked_partner_ids
        )
        partner_ids = [partner["id"] for partner in partner_records]

        # now we filter Odoo users out:
        user_partners = [
            u.partner_id.id
            for u in self.env["res.users"].search([("partner_id", "in", partner_ids)])
        ]
        partner_records = [
            p
            for p in filter(
                lambda partner: partner["id"] not in user_partners, partner_records
            )
        ]

        # now we put linked partners 1st:
        partner_records = sorted(
            partner_records, key=lambda x: x["id"] in linked_partner_ids, reverse=True
        )
        partner_ids = [partner["id"] for partner in partner_records]

        lead_records = self.env["crm.lead"].search_read(
            domain=[("partner_id", "in", partner_ids)],
            fields=self._get_frontapp_lead_fields(),
            limit=LEAD_LIMIT,
            order="write_date DESC",
        )
        for lead in lead_records:
            lead["href"] = (
                "%s/web#id=%s&action=%s&model=crm.lead&view_type=form&cids=&menu_id=%s"
                % (odoo_server, lead["id"], odoo_lead_action, odoo_lead_menu)
            )
        partner_leads = {
            partner["id"]: [
                lead for lead in lead_records if lead["partner_id"][0] == partner["id"]
            ]
            for partner in partner_records
        }
        for partner in partner_records:
            partner["opportunities"] = partner_leads[partner["id"]]
            partner["href"] = (
                "%s/web#id=%s&action=%s&model=res.partner&view_type=form&cids=&menu_id=%s"
                % (odoo_server, partner["id"], odoo_partner_action, odoo_partner_menu)
            )
            if partner.get("parent_id"):
                partner["parent_href"] = (
                "%s/web#id=%s&action=%s&model=crm.lead&view_type=form&cids=&menu_id=%s"
                % (odoo_server, partner["parent_id"][0], odoo_partner_action, odoo_partner_menu)
               )
            partner["conversation_id"] = conversation_key
            if self._frontapp_conversations([partner["id"]], conversation_key)[0]:
                partner["isLinked"] = True
        return partner_records

    def _frontapp_conversations(self, partner_ids, conversation_key=False):
        domain = [
            ("model", "=", "res.partner"),
            ("subtype_id", "=", self.env.ref("frontapp_plugin.frontapp_conversation_link").id),
        ]
        if partner_ids:
            domain.append(("res_id", "in", partner_ids))
        domain_other = domain
        if conversation_key:
            domain.append(("frontapp_conversation_key", "=", conversation_key))
        related_conversations = self.env["mail.message"].search(
            domain,
            order="write_date DESC",
        )

        domain_other.append(('id', 'not in', related_conversations.mapped("id")))
        if related_conversations and not partner_ids:
            domain_other.append(("res_id", "=", related_conversations[0].res_id))
        other_conversations = self.env["mail.message"].search(
            domain_other,
            order="write_date DESC",
            limit=LAST_CONVERSATIONS_COUNT,
        )
        return (related_conversations, other_conversations)

    def toggle_contact_link(self, is_linked, frontapp_context):
        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        conversation_key = frontapp_context["conversation"].get("id", "no_conversation")
        subject = frontapp_context["conversation"].get("subject", "no subject")
        blurb = frontapp_context["conversation"].get("blurb", "no description")
        for partner in self:
            existing_links = self._frontapp_conversations(
                [partner.id], conversation_key
            )[0]
            if is_linked:
                if not existing_links:
                    body = """<h3>%s</h3><a class="frontapp_conversation_link" target="_blank" href="https://app.frontapp.com/open/%s">%s...</a>""" % (
                        subject,
                        conversation_key,
                        blurb,
                    )
                    message = partner.message_post(
                        subject=subject,
                        body=body,
                        subtype_xmlid="frontapp_plugin.frontapp_conversation_link",
                    )
                    message.frontapp_conversation_key = conversation_key
            else:
                existing_links.unlink()
        return True

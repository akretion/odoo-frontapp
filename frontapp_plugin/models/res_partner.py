from odoo import api, fields, models

PARTNER_LIMIT = 10
LEAD_LIMIT = 5
LAST_CONVERSATIONS_COUNT = 5

class ResPartner(models.Model):
    _inherit = "res.partner"

    created_from_frontapp = fields.Boolean()
    # TODO FrontApp m2m computed links

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
        return super().search(
            domain,
            offset=0,
            limit=PARTNER_LIMIT,
            order="write_date DESC",
        )

    @api.model
    def search_from_frontapp(self, contact_emails, search_param, frontapp_context):
        odoo_server = self.env["ir.config_parameter"].sudo().get_param("web.base.url")
        odoo_partner_action = self.env.ref("base.action_partner_form").id
        odoo_partner_menu = self.env.ref("crm.res_partner_menu_customer").id

        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        conversation_key = frontapp_context["conversation"].get("id", "no_conversation")
        links = self._frontapp_conversations([], conversation_key)[0]
        linked_partner_ids = [link.res_id for link in links]

        partners = self._search_frontapp_partners(
            contact_emails, search_param, linked_partner_ids
        )
        partner_ids = partners.mapped("id")

        # now we filter Odoo users out:
        user_partners = self.env["res.users"].search(
            [("partner_id", "in", partner_ids)]
        ).mapped("id")
        partners = partners.filtered(lambda p: p.id not in user_partners)
        partner_leads = partners._get_partner_leads()
        partner_records = partners.read(fields=self._get_frontapp_partner_fields())
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
            related_conversations, other_conversations = self._frontapp_conversations(
                [partner["id"]], conversation_key
            )
            if related_conversations:
                partner["isLinked"] = True
            partner["other_conversations"] = [
                {
                    "id": m.id,
                    "subject": m.subject if m.subject else "",
                    "date": m.date,
                    "body": m.body,
                    "author": m.author_id.name if m.author_id else "",
                } for m in other_conversations
            ]

        # now we put linked partners or partners with more leads 1st:
        partner_records = sorted(
            partner_records, key=lambda x: (x["id"] in linked_partner_ids, len(x['opportunities'])), reverse=True
            # TODO append partners
        )
        return partner_records

    @api.model
    def create_contact_from_frontapp(self, name, frontapp_context, company_type):
        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        partner_data = {
            "created_from_frontapp": True,
            "company_type": company_type,
        }
        if company_type == "person" and hasattr(self, "firstname") and len(name.split(" ")) > 1:
            partner_data["firstname"] = name.split(" ")[0]
            partner_data["lastname"] = name.split(" ")[1]
        else:
            partner_data["name"] = name
        if frontapp_context["conversation"].get("assignee"):
            partner_data["email"] = frontapp_context["conversation"]["assignee"].get("email")
        partner = super().create(partner_data)
        partner.toggle_contact_link(True, frontapp_context)
        return self.search_from_frontapp([], False, frontapp_context)

    def _get_partner_leads(self):
        odoo_server = self.env["ir.config_parameter"].sudo().get_param("web.base.url")
        odoo_lead_action = self.env.ref("crm.crm_lead_action_pipeline").id
        odoo_lead_menu = self.env.ref("crm.crm_menu_leads").id
        partner_leads = {}
        for partner in self:
            leads = self.env['crm.lead']
            leads |= self.env['crm.lead'].search(
                [("partner_id", '=', partner.id)],
                limit=LEAD_LIMIT,
                order="write_date DESC",
            )
            lead_records = leads.read(fields=self._get_frontapp_lead_fields())
            for lead in lead_records:
                lead["href"] = (
                    "%s/web#id=%s&action=%s&model=crm.lead&view_type=form&cids=&menu_id=%s"
                    % (odoo_server, lead["id"], odoo_lead_action, odoo_lead_menu)
                )
            partner_leads[partner.id] = lead_records
        return partner_leads

    def _frontapp_conversations(self, partner_ids, conversation_key=False):
        domain = [("model", "=", "res.partner")]
        if partner_ids:
            domain.append(("res_id", "in", partner_ids))
        domain_other = domain.copy()
        if conversation_key:
            domain.append(("frontapp_conversation_key", "=", conversation_key))
            domain.append(("subtype_id", "=", self.env.ref("frontapp_plugin.frontapp_conversation_link").id))
        related_conversations = self.env["mail.message"].search(
            domain,
            order="write_date DESC",
        )

        domain_other.append(("subtype_id", "=", self.env.ref("mail.mt_note").id))
        domain_other.append(("message_type", "=", "comment"))
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

    def create_contact_opportunity(self, name, frontapp_context):
        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        for partner in self:
            opp = self.env["crm.lead"].create({
                "name": name,
                "partner_id": partner.id,
                "created_from_frontapp": True,
            })
            partner.toggle_contact_link(True, frontapp_context)
        return self.search_from_frontapp([], False, frontapp_context)

    def create_contact_note(self, body, frontapp_context):
        if not frontapp_context:
            frontapp_context = {"conversation": {}}  # useful for local testing
        for partner in self:
            message = partner.message_post(
                body=body,
                message_type="comment",
                subtype_xmlid="mail.mt_note",
            )
            partner.toggle_contact_link(True, frontapp_context)
        return self.search_from_frontapp([], False, frontapp_context)

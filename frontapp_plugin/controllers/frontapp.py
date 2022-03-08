# Copyright 2021 AKRETION
# License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl.html).

from odoo.http import Controller, request, route


class FrontappPluginController(Controller):
    @route(
        ["/frontapp-plugin"],
        methods=["GET"],
        type="http",
        auth="public",
    )
    def index(self, **params):
        request.env["ir.config_parameter"].sudo().get_param("web.base.url")
        return request.render("frontapp_plugin.frontapp-plugin", {})

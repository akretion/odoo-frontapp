odoo.define("web.frontapp", function (require) {
    "use strict";

    var simple_ajax = require("web.simple_ajax");

    (function () {
        const {Component, Store, mount} = owl;
        const {xml} = owl.tags;
        const {whenReady} = owl.utils;
        const {useRef, useDispatch, useState, useStore} = owl.hooks;

        // -------------------------------------------------------------------------
        // Store
        // -------------------------------------------------------------------------
        const actions = {
            addContact({state}, contact) {
                console.log("ADD CONTACT", contact);
                if (contact) {
                    state.contacts.push(contact);
                }
            },
            toggleContactLink({state}, id) {
                window.odoo_app.dispatch("ensureFrontappContext");
                var contact = state.contacts.find((t) => t.id === id);
                simple_ajax
                    .jsonRpc(
                        "/web/dataset/call_kw/res.partner",
                        "call",
                        {
                            model: "res.partner",
                            method: "toggle_contact_link",
                            args: [
                                [contact.id],
                                !contact.isLinked,
                                state.frontappContext,
                            ],
                            kwargs: {context: {}},
                        },
                        {headers: {}}
                    )
                    .then(function (result) {
                        contact.isLinked = !contact.isLinked;
                    })
                    .guardedCatch(function () {
                        console.log("link/unlink KO!", this);
                    });
            },
            deleteContact({state}, id) {
                const index = state.contacts.findIndex((t) => t.id === id);
                state.contacts.splice(index, 1);
            },
            resetContacts({state}, id) {
                state.contacts = [];
            },
            createOpportunity({state}, id) {
                var contact = state.contacts.find((t) => t.id === id);
                var input =  document.getElementById('opp_input_' + id);
                var name = input.value;
                if (name == "") {
                    $('#error')[0].innerHTML = "Opportunity text cannot be blank!";
                    return;
                }
                simple_ajax
                    .jsonRpc(
                        "/web/dataset/call_kw/res.partner",
                        "call",
                        {
                            model: "res.partner",
                            method: "create_contact_opportunity",
                            args: [
                                [contact.id],
                                name,
                                state.frontappContext,
                            ],
                            kwargs: {context: {}},
                        },
                        {headers: {}}
                    )
                    .then(function (contacts) {
                        contact.isLinked = true;
                        var input =  document.getElementById('opp_input_' + id);
                        input.value = "";
                        var app = window.odoo_app;
                        app.dispatch("resetContacts");
                        contacts.forEach((contact, i) => {
                            app.dispatch("addContact", contact);
                        });
                    })
                    .guardedCatch(function () {
                        console.log("create_contact_opportunity KO!", this);
                    });
            },
            createNote({state}, id) {
                console.log("create note", id)
                var contact = state.contacts.find((t) => t.id === id);
                var input =  document.getElementById('note_input_' + id);
                var body = input.value;
                if (body == "") {
                    $('#error')[0].innerHTML = "Note body cannot be blank!";
                    return;
                }
                simple_ajax
                    .jsonRpc(
                        "/web/dataset/call_kw/res.partner",
                        "call",
                        {
                            model: "res.partner",
                            method: "create_contact_note",
                            args: [
                                [contact.id],
                                body,
                                state.frontappContext,
                            ],
                            kwargs: {context: {}},
                        },
                        {headers: {}}
                    )
                    .then(function (contacts) {
                        contact.isLinked = true;
                        var input =  document.getElementById('note_input_' + id);
                        input.value = "";
                        var app = window.odoo_app;
                        app.dispatch("resetContacts");
                        contacts.forEach((contact, i) => {
                            app.dispatch("addContact", contact);
                        });
                    })
                    .guardedCatch(function () {
                        console.log("create_contact_note KO!", this);
                    });
            },
            ensureFrontappContext({state}, frontappContext) {
                console.log("ensureFrontappContext");
                if (frontappContext) {
                    console.log("setting FrontApp Context to", frontappContext);
                    state.frontappContext = frontappContext;
                }
                if (window.location !== window.parent.location) {
                    frontappContext = state.frontappContext;
                    if (!(frontappContext && frontappContext.conversation && frontappContext.conversation.subject !== undefined)) {
                        var error = "Warning no FrontApp Conversion found!<br/>You might try select a conversation or try to refresh your browser using F5 if the problem persists."
                        $('#error')[0].innerHTML = error;
                        throw error;
                    }
                }
            },
        };

        const initialState = {
            name: "frontapp-odoo",
            nextId: 1,
            contacts: [],
            frontappContext: {conversation: {id: "no_conversation"}},
        };

        // -------------------------------------------------------------------------
        // Note Component
        // -------------------------------------------------------------------------
        const NOTE_TEMPLATE = xml`
    <div class="note">
      <i class="fa fa-comment" />
      <span class="note-date" ><t t-esc="props.note.date"/></span>
      <span class="note-author" ><t t-esc="props.note.author"/></span>
      <div class="ml-1" ><t t-esc="props.note.subject"/></div>
      <div class="ml-1" ><t t-raw="props.note.body"/></div>
    </div>`;

        class Note extends Component {
            static template = NOTE_TEMPLATE;
            static props = ["note"];
            dispatch = useDispatch();
        }

        // -------------------------------------------------------------------------
        // Opportunity Component
        // -------------------------------------------------------------------------
        const OPPORTUNITY_TEMPLATE = xml`
    <div class="opportunity">
      <i class="fa fa-rocket" />
      <a class="pl-1" t-att-href="props.opportunity.href" target="_blank">
        <t t-esc="props.opportunity.name"/>
      </a>
        -
      <t t-esc="props.opportunity.stage_id[1]"/>
      <i class="fa fa-star pl-1" t-foreach="[...Array(props.opportunity.stars).keys()]" />
    </div>`;

        class Opportunity extends Component {
            static template = OPPORTUNITY_TEMPLATE;
            static props = ["opportunity"];
            dispatch = useDispatch();
        }

        // -------------------------------------------------------------------------
        // Contact Component
        // -------------------------------------------------------------------------
        const CONTACT_TEMPLATE = xml`
    <div class="contact" t-att-class="props.contact.isLinked ? 'linked' : ''">
        <div class="contact-info">
        <input type="checkbox" t-att-checked="props.contact.isLinked"
            t-att-id="props.contact.id"
            t-on-click="dispatch('toggleContactLink', props.contact.id)"/>

        <t t-if="props.contact.company_type=='company'" >
          <i class="fa fa-institution" />
        </t>
        <t t-else="" >
          <i class="fa fa-address-card-o" />
        </t>
        <a class="pl-1" t-att-href="props.contact.href" target="_blank">
          <t t-esc="props.contact.name"/>
        </a>
        <span class="delete" t-on-click="dispatch('deleteContact', props.contact.id)">🗑</span>
        </div>

        <div class="ml-1" t-if="props.contact.categories.length > 0" >
            <span class="tag" t-foreach="props.contact.categories"
                    t-as="tag" t-key="tag" t-esc="tag" />

        </div>

        <!-- FIXME these are customer specific fields -->
        <div t-if="props.contact.stage_id" >
            <i class="fa fa-forward" />
            <span class="pl-1" >
              <t t-esc="props.contact.stage_id[1]" />
            </span>
        </div>
        <div t-if="props.contact.relation_id" >
            <i class="fa fa-battery-2" />
            <span class="pl-1" >
              <t t-esc="props.contact.relation_id[1]" />
            </span>
        </div>

        <div t-if="props.contact.function" >
          <t t-esc="props.contact.function" />
        </div>
        <div t-if="props.contact.phone" >
            <i class="fa fa-phone" />
            <span class="pl-1" >
              <t t-esc="props.contact.phone" />
            </span>
        </div>
        <div t-if="props.contact.mobile" >
            <i class="fa fa-mobile-phone" />
            <span class="pl-1" >
              <t t-esc="props.contact.mobile" />
            </span>
        </div>
        <div t-if="props.contact.parent_href" >
          <i class="fa fa-institution" />
          <span class="pl-1" >
            <a class="pl-1" t-att-href="props.contact.parent_href" target="_blank">
              <t t-esc="props.contact.parent_id[1]" />
            </a>
          </span>
        </div>
        <div>
          <i class="fa fa-map-marker" />

            <span class="pl-1" t-if="props.contact.zip" >
              <t t-esc="props.contact.zip" />
            </span>
            <div t-if="props.contact.city" >
              <t t-esc="props.contact.city" />
            </div>
            <div t-if="props.contact.country_id" >
              <t t-esc="props.contact.country_id[1]" />
            </div>

        </div>
        <div t-if="props.contact.user_id" >
          <i class="fa fa-user" />
          <span class="pl-1">
            <t t-esc="props.contact.user_id[1]" />
          </span>
        </div>
        <div t-if="props.contact.privileged_distrib_id" >
          <!-- FIXME this is a customer specific field -->
          <i class="fa fa-industry" />
          <span class="pl-1">
            <t t-esc="props.contact.privileged_distrib_id[1]" />
          </span>
        </div>

        <div class="opportunity-list">
            <Opportunity t-foreach="props.contact.opportunities" t-as="opportunity" t-key="opportunity.id" opportunity="opportunity"/>
        </div>
        <div class="opportunity-create">
          <button t-on-click="dispatch('createOpportunity', props.contact.id)" >
            <i class="fa fa-save"/>
          </button>
          <input class="ml-1" placeholder="create Opportunity" t-att-id="'opp_input_' + props.contact.id"/>
        </div>

        <div class="note-list">
            <Note t-foreach="props.contact.other_conversations" t-as="note" t-key="note.id" note="note"/>
        </div>
        <div class="note-create">
          <button t-on-click="dispatch('createNote', props.contact.id)" >
            <i class="fa fa-save"/>
          </button>
          <textarea class="ml-1" placeholder="create Note" t-att-id="'note_input_' + props.contact.id"/>
        </div>
    </div>`;

        class Contact extends Component {
            static template = CONTACT_TEMPLATE;
            static props = ["contact"];
            static components = {Opportunity, Note};
            dispatch = useDispatch();
        }

        // -------------------------------------------------------------------------
        // App Component
        // -------------------------------------------------------------------------
        const APP_TEMPLATE = xml`
    <div class="frontapp-odoo">
        <div>
          <button>
            <i class="fa fa-search" t-on-click="searchContact" />
          </button>
          <input id="search_input" placeholder="Search for Odoo contact" t-on-keyup="searchContact" t-ref="add-input"/>
        </div>
        <div>
          <button t-on-click="createContact">
            <i class="fa fa-save" />
            Create Contact (FirstName LastName)
          </button>
        </div>
        <div>
          <button t-on-click="createCompany">
            <i class="fa fa-save"  />
            Create Company
          </button>
        </div>

        <div class="contact-panel" t-if="contacts.length">
            <a style="float:right" href="/web/session/logout?redirect=/frontapp-plugin">Logout</a>
            <div>
                <i class="fa fa-filter" />
                <span class="pl-1" t-foreach="['all', 'linked']"
                    t-as="f" t-key="f"
                    t-att-class="{active: filter.value===f}"
                    t-on-click="setFilter(f)"
                    t-esc="f"/>
            </div>
        </div>
        <div id="error"></div>
	<div id="login" style="display:none;margin-top:10px">
            <form class="oe_login_form" role="form" method="post" onsubmit="this.action = '/web/login' + location.hash" action="/web/login">
                <input type="hidden" name="csrf_token" id="csrf_token" />
                <div class="form-group field-login">
                    <label for="login">Email</label>
                    <input type="text" placeholder="Email" name="login" id="login" required="required" autofocus="autofocus" autocapitalize="off" class="form-control "/>
                </div>

                <div class="form-group field-password">
                    <label for="password">Login</label>
                    <input type="password" placeholder="Password" name="password" id="password" required="required" autocomplete="current-password" maxlength="4096" class="form-control "/>
                </div>

                <div class="clearfix oe_login_buttons text-center mb-1 pt-3">
                    <button type="submit" class="btn btn-primary btn-block">Connexion</button>
                </div>
		<input type="hidden" name="redirect" value="/frontapp-plugin" />
            </form>
	</div>
        <div id="info"></div>
        <div class="contact-list">
            <Contact t-foreach="displayedContacts" t-as="contact" t-key="contact.id" contact="contact"/>
        </div>
    </div>`;

        class App extends Component {
            static template = APP_TEMPLATE;
            static components = {Contact};
            //static props = ["name"];

            inputRef = useRef("add-input");
            contacts = useStore((state) => state.contacts);
            frontappContext = useStore((state) => state.frontappContext);
            filter = useState({value: "all"});
            dispatch = useDispatch();

            mounted() {
                this.inputRef.el.focus();
                this.state = useState(initialState);
            }

            addContact(ev) {
                // 13 is keycode for ENTER
                if (ev.keyCode === 13) {
                    this.dispatch("addContact", ev.target.value);
                    ev.target.value = "";
                }
            }

            createContact(ev) {
                window.odoo_app.dispatch("ensureFrontappContext");
                if (this.inputRef.el.value == "") {
                    $('#error')[0].innerHTML = "Contact name cannot be blank! (write the name in the search box)";
                    return;
                }
                createOdooContact(this.state.frontappContext, this.inputRef.el.value, "person");
                this.inputRef.el.value = "";
            }

            createCompany(ev) {
                window.odoo_app.dispatch("ensureFrontappContext");
                if (this.inputRef.el.value == "") {
                    $('#error')[0].innerHTML = "Company name cannot be blank! (write it in the search box)";
                    return;
                }
                createOdooContact(this.state.frontappContext, this.inputRef.el.value, "company");
                this.inputRef.el.value = "";
            }

            searchContact(ev) {
                // 13 is keycode for ENTER
                if (ev.keyCode === 13 || !ev.keyCode) {
                    loadContacts([], this.state.frontappContext, this.inputRef.el.value);
                    //ev.target.value = "";
                }
            }

            get displayedContacts() {
                switch (this.filter.value) {
                    case "linked":
                        return this.contacts.filter((t) => t.isLinked);
                    case "all":
                        return this.contacts;
                }
            }

            setFilter(filter) {
                this.filter.value = filter;
            }
        }

        // -------------------------------------------------------------------------
        // Setup code
        // -------------------------------------------------------------------------
        function makeStore() {
            const localState = window.localStorage.getItem("frontapp-odoo");
            const state = initialState;
            const store = new Store({state, actions});
            store.on("update", null, () => {
                localStorage.setItem("frontapp-odoo", JSON.stringify(store.state));
            });
            return store;
        }

        function setup() {
            owl.config.mode = "prod";
            const env = {store: makeStore()};
            mount(App, {target: document.body, env}).then((app) => {
                window.odoo_app = app;
                if (window.location == window.parent.location) {
                    // demo data for localhost testing:
                    loadContacts(
                        [
                            "hello@dualsun.com",
                            "info@agrolait.com",
                            "info@deltapc.com",
                            "billy.fox45@example.com",
                        ],
                        {}
                    );
                }
            });
        }

	function showLoginForm() {
	    $("#login")[0].style.display = "block";
	    $("#csrf_token")[0].value = odoo.csrf_token;
	}

        function loadContacts(contact_emails, frontappContext, search_param) {
            //console.log("loadContacts", contact_emails, frontappContext, search_param);
            var app = window.odoo_app;
            app.dispatch("ensureFrontappContext", frontappContext);
            simple_ajax
                .jsonRpc(
                    "/web/dataset/call_kw/res.partner",
                    "call",
                    {
                        model: "res.partner",
                        method: "search_from_frontapp",
                        args: [contact_emails, search_param, frontappContext],
                        kwargs: {},
                    },
                    {headers: {}}
                )
                .then(function (contacts) {
                    //console.log("contact promise resolved!", contacts);
                    app.dispatch("resetContacts");
                    if (contacts.length > 0) {
                      $('#info')[0].innerHTML = "";
                      //$('#error')[0].innerHTML = "";
                    } else {
                      $('#info')[0].innerHTML = "No contact matching this conversation!<br/>You can search for a contact (by name or email) and link it to the conversation.<br/>Or you can also create a new Odoo contact or company.";
                    }
                    contacts.forEach((contact, i) => {
                        app.dispatch("addContact", contact);
                    });
                })
                .guardedCatch(function (error) {
		    if (error && error.message && error.message.code == 100) {
			showLoginForm();
		    } else {
        		console.log("contact search KO!", this, error);
		    }
                });
        }

        function createOdooContact(frontappContext, name, company_type) {
            var app = window.odoo_app;
            simple_ajax
                .jsonRpc(
                    "/web/dataset/call_kw/res.partner",
                    "call",
                    {
                        model: "res.partner",
                        method: "create_contact_from_frontapp",
                        args: [name, frontappContext, company_type],
                        kwargs: {},
                    },
                    {headers: {}}
                )
                .then(function (contacts) {
                    app.dispatch("resetContacts");
                    contacts.forEach((contact, i) => {
                        app.dispatch("addContact", contact);
                    });
                })
                .guardedCatch(function () {
                    console.log("create contact KO!", this);
                });
        }

        Front.contextUpdates.subscribe((context) => {
            switch (context.type) {
                case "noConversation":
                    console.log("No conversation selected");
                    break;
                case "singleConversation":
                    console.log("Selected conversation:", context.conversation);
                    // TODO  assignee can be undefined in https://app.frontapp.com/inboxes/teams/views/9523270/open/26322453318
                    var contacts = [];
                    if (context.conversation && context.conversation.assignee) {
                        contacts.push(context.conversation.assignee.email)
                    }
                    if (context.conversation && context.conversation.recipient) {
                        contacts.push(context.conversation.recipient.handle)
                    }
                    $('#search_input')[0].value="";
                    $('#error')[0].innerHTML = "";
                    loadContacts(contacts, context);
                    break;
                case "multiConversations":
                    console.log(
                        "Multiple conversations selected",
                        context.conversations
                    );
                    break;
                default:
                    console.error(`Unsupported context type: ${context.type}`);
                    break;
            }
        });

        whenReady(setup);
    })();
});

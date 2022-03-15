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
                const contact = state.contacts.find((t) => t.id === id);
                //contact.isLinked = !contact.isLinked;
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
            setFrontappContext({state}, context) {
                state.frontappContext = context;
            },
        };

        const initialState = {
            name: "frontapp-odoo",
            nextId: 1,
            contacts: [],
            frontappContext: {conversation: {id: "no_conversation"}},
        };

        // -------------------------------------------------------------------------
        // Opportunity Component
        // -------------------------------------------------------------------------
        const OPPORTUNITY_TEMPLATE = xml`
    <div class="opportunity">
      <i class="fa fa-rocket" />
      <a class="pl-1" t-att-href="props.opportunity.href" target="_blank">
        <t t-esc="props.opportunity.name"/>
      </a>
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
        <div class="opportunity-list">
            <Opportunity t-foreach="props.contact.opportunities" t-as="opportunity" t-key="opportunity.id" opportunity="opportunity"/>
        </div>
    </div>`;

        class Contact extends Component {
            static template = CONTACT_TEMPLATE;
            static props = ["contact"];
            static components = {Opportunity};
            dispatch = useDispatch();
        }

        // -------------------------------------------------------------------------
        // App Component
        // -------------------------------------------------------------------------
        const APP_TEMPLATE = xml`
    <div class="frontapp-odoo">
        <div class="contact-list">
            <Contact t-foreach="displayedContacts" t-as="contact" t-key="contact.id" contact="contact"/>
        </div>
        <div class="contact-panel" t-if="contacts.length">
            <!--div class="contact-counter">
                <t t-esc="displayedContacts.length"/>
                <t t-if="displayedContacts.length lt contacts.length">
                    / <t t-esc="contacts.length"/>
                </t>
                contact(s)
            </div-->
            <div>
                <span t-foreach="['all', 'linked']"
                    t-as="f" t-key="f"
                    t-att-class="{active: filter.value===f}"
                    t-on-click="setFilter(f)"
                    t-esc="f"/>
            </div>
        </div>
        <input placeholder="Search for partner" t-on-keyup="searchContact" t-ref="add-input"/>
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
                this.state = useState({name: "Hello"});
            }

            addContact(ev) {
                // 13 is keycode for ENTER
                if (ev.keyCode === 13) {
                    this.dispatch("addContact", ev.target.value);
                    ev.target.value = "";
                }
            }

            searchContact(ev) {
                // 13 is keycode for ENTER
                if (ev.keyCode === 13) {
                    loadContacts([], {}, ev.target.value);
                    ev.target.value = "";
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
            //const state = localState ? JSON.parse(localState) : initialState;
            const state = initialState;
            const store = new Store({state, actions});
            store.on("update", null, () => {
                localStorage.setItem("frontapp-odoo", JSON.stringify(store.state));
            });
            return store;
        }

        function setup() {
            owl.config.mode = "dev";
            const env = {store: makeStore()};
            mount(App, {target: document.body, env}).then((app) => {
                window.odoo_app = app;
                console.log(app);
                // TODO FIXME: useful for testing:
                loadContacts(
                    [
                        "info@agrolait.com",
                        "info@deltapc.com",
                        "billy.fox45@example.com",
                    ],
                    {}
                );
            });
        }

        function loadContacts(contact_emails, frontappContext, search_param) {
            console.log("loadContacts", contact_emails, frontappContext, search_param);
            var app = window.odoo_app;
            if (typeof frontappContext.conversation !== "undefined") {
                app.dispatch("setFrontappContext", frontappContext);
            }
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
                    // TODO inject conversation ID to find out if contacts related to conversation or not
                )
                .then(function (contacts) {
                    console.log("contact promise resolved!", contacts);
                    app.dispatch("resetContacts");
                    contacts.forEach((contact, i) => {
                        app.dispatch("addContact", contact);
                    });
                })
                .guardedCatch(function () {
                    console.log("contact search KO!", this);
                });
        }

        Front.contextUpdates.subscribe((context) => {
            switch (context.type) {
                case "noConversation":
                    console.log("No conversation selected");
                    break;
                case "singleConversation":
                    console.log("Selected conversation:", context.conversation);
                    var contacts = [
                        context.conversation.assignee.email,
                        context.conversation.recipient.handle,
                    ];
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

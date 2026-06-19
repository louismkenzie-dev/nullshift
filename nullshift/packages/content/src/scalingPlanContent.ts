/**
 * Free Scaling Plan content bank — deep, per-industry consultation copy authored
 * (and adversarially reviewed) for every funnel answer dimension, plus hand-crafted
 * hero plans for the top industry×pain combos. Consumed by buildScalingPlan() in
 * scalingPlan.ts. Generated content — edit deliberately. No pricing here by design.
 */
import type { ScalingContent } from "./scalingPlan";

export const SCALING_CONTENT: ScalingContent = {
  verticals: {
    clinic: {
      id: "allied-health",
      diagnosis:
        "You are running a multi-practitioner clinic on a per-seat practice-management platform such as Cliniko, Jane or Nookal, renting a fresh login for every osteopath, physio and therapist you take on. Online booking, two-way SMS reminders and card payments are bolt-ons you switch on inside that same tool, so the things that actually fill your diary are features you rent rather than systems you own. The software dictates how you book, chart, recall and get paid, and your front desk bends its day around the tool instead of the tool bending around your clinic. Every account, every patient note and every payment rail sits inside someone else's database.",
      saasToCut: [
        {
          name: "Cliniko",
          note: "Allied-health practice management billed per active practitioner, so every clinician you add lands on the bill before they have treated a single patient; booking, reminders and payments are all features you switch on inside their platform rather than systems you control.",
        },
        {
          name: "Jane App",
          note: "Per-practitioner clinic platform where online booking, charting and text reminders are bundled in, and card payments run through its built-in processing on terms it sets, keeping the merchant relationship and your patient payments inside its walls.",
        },
        {
          name: "Nookal",
          note: "Australian-built physio and allied-health software priced per practitioner, where extra sites, additional logins and the reporting you need to run the clinic all scale with your headcount, and your historic notes live inside their database.",
        },
        {
          name: "TM3 / PPS by Blue Zinc",
          note: "Long-standing UK physiotherapy practice-management software licensed per user, where multi-site, remote access and the insurer-billing modules clinics actually depend on sit across higher tiers and paid add-ons.",
        },
        {
          name: "Power Diary",
          note: "Per-practitioner clinic diary where two-way SMS, online intake forms, telehealth and recalls are gated behind plan tiers and metered messaging, so the features that keep your diary full are rented capacity rather than capability you own.",
        },
      ],
      automations: [
        {
          title: "Deposit-backed booking that ends no-shows",
          detail:
            "Online bookings are held with a deposit or prepayment taken through your own account, captured or refunded automatically against your cancellation window, so empty diary slots stop quietly burning a clinician's hour.",
        },
        {
          title: "Two-way reminders on your own cadence",
          detail:
            "Confirmations and reminders go out by SMS and email on the schedule your clinic chooses, each with a one-tap reschedule link, instead of being rationed by whatever your platform bundles into its plan.",
        },
        {
          title: "Automatic recall for treatment plans",
          detail:
            "When a course of physio or osteo care lapses, or a chiropractic review falls due, the system prompts the patient to rebook at the right interval, recovering the follow-ups clinics routinely lose to a busy front desk.",
        },
        {
          title: "Digital intake and consent before the first visit",
          detail:
            "New patients complete medical history, red-flag screening and treatment consent digitally before they arrive, landing straight on the clinician's screen so chair time is spent assessing and treating, not filling in forms.",
        },
        {
          title: "Insurer and self-pay invoicing on autopilot",
          detail:
            "Itemised invoices and receipts are generated after each visit with the provider, registration and treatment-code references private medical insurers expect, ready to send without the front desk retyping a thing.",
        },
        {
          title: "Discharge and outcome follow-up",
          detail:
            "After discharge the system sends a recovery check-in and a review request, turning patients who got better into referrals and ratings without anyone chasing them by hand.",
        },
      ],
      elements: [
        {
          title: "Online booking with deposits",
          detail:
            "A booking flow built around your clinicians' real availability, room and equipment constraints and appointment types — initial assessment, follow-up, shockwave, longer first visit — taking a deposit through your own account at the point of booking.",
        },
        {
          title: "Clinical records and notes",
          detail:
            "Structured patient records with body charts, range-of-motion and outcome measures, treatment history and document storage, shaped around how physios, osteopaths and chiropractors actually chart rather than a generic template.",
        },
        {
          title: "Payments through your own Stripe",
          detail:
            "Card payments settle directly into your clinic's own merchant account, with the payment relationship and the patient money staying yours rather than routed through a booking tool you do not control.",
        },
        {
          title: "Patient portal",
          detail:
            "A logged-in area where patients view upcoming appointments, rebook, complete intake forms, download invoices for their insurer and access prescribed exercises and aftercare guidance.",
        },
        {
          title: "Multi-practitioner diary you own",
          detail:
            "A clinic-wide calendar spanning every clinician, treatment room and site, owned outright, so adding an associate physio or opening a second location is a configuration change rather than another seat to rent.",
        },
      ],
      opportunities: [
        {
          title: "Add clinicians without adding a single subscription",
          detail:
            "Because the system is yours and not licensed per seat, taking on associate physios, osteopaths or therapists grows your treating capacity without a rented login attached to each new pair of hands.",
        },
        {
          title: "Open a second site on the same system",
          detail:
            "One owned platform runs multiple locations with shared records and a single booking front door, so a second clinic is a configuration change rather than a higher subscription tier and a fresh stack of per-seat charges.",
        },
        {
          title: "Own the patient relationship and the data",
          detail:
            "With your full patient and outcome history in a UK-hosted database you control and can export at any time, you can run recall campaigns, track clinical outcomes and build referral programmes that a rented platform would gatekeep behind a higher plan.",
        },
      ],
      opsTrap:
        "Generic practice-management software forces every clinic into the same mould — its booking rules, its note templates, its reminder cadence, its payment rail and its definition of a discharge or recall — and you reshape your front desk and clinical workflow to fit a tool that was never built for your clinic. As you add practitioners and open sites, that compromise scales with you, a rented login follows every new clinician, and your patient history stays locked inside their database. A bespoke system you own inverts it: the software bends to how your clinic actually runs, payments flow through your own account, and the records, the relationships and every account stay yours to keep and build on. Own your system, stop renting it per seat, and cut the monthly bill.",
    },
    wellness: {
      id: "wellness",
      diagnosis:
        "You're running a gym, studio or coaching practice on rented platforms like Mindbody, Glofox or TeamUp, managing your own timetable, memberships and clients inside software you'll never own, while ClassPass quietly fills your off-peak slots with low-value drop-ins who rarely come back. Your timetable, your member list and every class booking, rebill and recall live inside someone else's system, so the whole engine that runs your business answers to their rules, their app and their roadmap, not yours. The day you want to do something they didn't build for, you're stuck, and the member relationships you worked to win were never really yours to keep.",
      saasToCut: [
        {
          name: "Mindbody / Glofox / TeamUp / Hapana",
          note: "The all-in-one booking platform you rent to run your entire timetable, memberships and class registers. You bend your studio to its class-credit rules, membership types and branded app, and the member relationships it holds were never yours to own or move.",
        },
        {
          name: "ClassPass",
          note: "Pushes your empty off-peak slots to bargain-hunting drop-ins and sits between you and your local market, training people to book your studio through a third party instead of joining you direct, and keeping the relationship and the data on their side.",
        },
        {
          name: "Trainerize / TrueCoach / PT Distinction / My PT Hub",
          note: "The separate app your coaches use to deliver programmes and check in with clients, bolted on alongside your booking system so client history is split across two tools and tied to whichever platform you happen to rent this year.",
        },
        {
          name: "Stripe / GoCardless run through the booking platform",
          note: "Your memberships and class packs are billed through your booking tool's payment layer, so the recurring billing relationship and your members' card details sit inside their system rather than an account you control and can take with you.",
        },
        {
          name: "Mailchimp / ActiveCampaign",
          note: "A separate subscription bolted on for member newsletters and win-back emails, needed only because your booking platform exports little and automates less, so your member list lives in yet another tool you rent.",
        },
      ],
      automations: [
        {
          title: "Recurring membership billing with automatic dunning",
          detail:
            "Memberships and class packs rebill on schedule through your own payment account, and failed payments are retried and chased by email and SMS automatically, so lapsed cards are recovered before anyone quietly slips off your books.",
        },
        {
          title: "Class waitlist auto-fill",
          detail:
            "When someone drops out of a full class, the next member on the waitlist is offered the spot and confirmed automatically, so your most popular sessions stay full without you watching the timetable all day.",
        },
        {
          title: "No-show and late-cancellation handling",
          detail:
            "Late cancellations and no-shows automatically deduct a class credit or apply your policy under rules you set, protecting capacity in your busiest peak slots without an awkward conversation.",
        },
        {
          title: "Lapsed-member win-back",
          detail:
            "When a member's attendance drops off or they stop booking, they're sent a personal nudge or a tailored offer to come back automatically, so drifting members are caught early instead of churning in silence.",
        },
        {
          title: "New-joiner and new-client onboarding journey",
          detail:
            "Every new member or PT client is walked through a sequence — welcome, consent and PAR-Q forms, first-session booking and goal-setting — without you sending a single manual message.",
        },
        {
          title: "Block-booking and class-pack renewal reminders",
          detail:
            "Clients on six- or twelve-week PT blocks and members on expiring class packs are reminded to rebook or renew before they run out, keeping schedules full and revenue continuous.",
        },
      ],
      elements: [
        {
          title: "Timetable and class booking with deposits",
          detail:
            "A live timetable on your own site where members book and pay for classes, courses and PT slots directly, with a deposit or class credit taken upfront to hold the spot and cut no-shows.",
        },
        {
          title: "Membership and class-pack management",
          detail:
            "Memberships, drop-ins, class packs and PT blocks all managed in one system you own, with credits, freezes, upgrades and renewals handled the way your studio actually works rather than the way a rented app forces.",
        },
        {
          title: "Branded member portal",
          detail:
            "A members' area under your own name where clients manage their membership, book and cancel classes, track attendance and follow their programme, instead of logging into a generic platform that puts its brand in front of yours.",
        },
        {
          title: "Client records with intake, consent and PAR-Q screening",
          detail:
            "Health questionnaires, PAR-Q screening, consent and goals are captured at sign-up and stored against each client, so your coaches have the full picture before a first session and nothing lives in a separate coaching app.",
        },
        {
          title: "Payments through your own account",
          detail:
            "Memberships, packs and one-off bookings settle straight into a payment account you own and control, with the billing relationship and your members' details staying with you rather than locked inside a booking platform.",
        },
      ],
      opportunities: [
        {
          title: "Win back the off-peak slots ClassPass owns",
          detail:
            "With your own booking, pricing and off-peak offers, you fill quiet sessions with members who book you direct and stay, instead of commission-driven drop-ins who never come back, and you own the relationship from the first class.",
        },
        {
          title: "Launch new formats and online programmes without buying more software",
          detail:
            "Add challenges, courses, hybrid online coaching or a second location inside the system that already holds your members and their history, rather than bolting on yet another subscription every time you grow.",
        },
        {
          title: "Own the member data that drives retention",
          detail:
            "Because attendance, spend and lapse patterns are all yours, you can see who's drifting and act early, turning retention from a guess into a system you control, measure and improve over time.",
        },
      ],
      opsTrap:
        "Generic gym and studio software forces your business to fit its mould — its class-credit logic, its membership types, its billing cadence, its app — and the moment that model doesn't match how you actually run sessions, blocks or hybrid coaching, you bend your operations to the software and paper over the gaps with spreadsheets and manual messages. A bespoke system you own flips that round: the booking rules, membership structure and member journey are built around how your studio really works, your members and their entire history stay yours to keep and move, and you stop renting the very engine that runs your timetable. We're not selling you another booking app to log into, we're selling you the system you own outright and the members who book direct because of it. A booked call turns this free outline into a tailored consultation, mapping your exact tools, timetable and member journey to a system designed around you.",
    },
    salon: {
      id: "salon",
      diagnosis:
        "You are running a chair-and-treatment business on rented booking software that was built to fill someone else's marketplace, not yours. Your calendar, your client cards, your colour formulas and your reminder history all live inside a platform you do not own and cannot fully query, so the rules of your business are set by what the software permits. Treatwell and Fresha sit between you and clients walking through your own front door, while Phorest, Booksy and Mindbody lock the people you have spent years building loyalty with inside a database you are only renting. The day you want to leave, you cannot take that history out cleanly, which is exactly how the lock-in is designed to work.",
      saasToCut: [
        {
          name: "Treatwell",
          note: "A discovery marketplace that classes new-client bookings as its own, so clients who would have found your salon anyway are routed through someone else's brand and listed next to your competitors. You shape your menu and availability around what the marketplace rewards, not what your salon needs.",
        },
        {
          name: "Fresha",
          note: "Sold as free, but the trade is that your bookings, payments and client data run through Fresha's marketplace and rails rather than your own. Your client relationships and card payments sit inside a platform you do not control and cannot take with you cleanly.",
        },
        {
          name: "Booksy",
          note: "Booking software priced per practitioner, so the cost of the tooling scales with your team rather than with your results. Every stylist or therapist you add makes the platform more expensive to keep, and the Boost marketplace nudges you to treat your own regulars as new-client leads.",
        },
        {
          name: "Phorest",
          note: "Per-location, per-staff salon software where SMS reminders, online deposits and marketing campaigns sit behind tiers and add-ons. The features you actually rely on to fill the calendar are metered, and your entire client base lives in a vendor database you cannot export on your own terms.",
        },
        {
          name: "Mindbody / Pabau",
          note: "Heavyweight platforms aimed at aesthetics and clinics that bundle booking, consent forms and client records into one rented stack. Your patch-test history, treatment notes and consent records, the very data your insurer cares about, are held inside their schema rather than in a system you own.",
        },
        {
          name: "Timely",
          note: "Polished salon booking software billed per user, so growth is taxed seat by seat, and your formulas, intake forms and rebooking history stay locked to the vendor. Convenient until the day you outgrow it and discover your client history will not come with you.",
        },
      ],
      automations: [
        {
          title: "Deposit-protected booking",
          detail:
            "Every online booking takes a card deposit at the point of booking through your own payment account, so colour appointments, gel infills and aesthetics consults are held with real commitment. A late no-show no longer means an empty chair you cannot fill, and the rules for which services need a deposit are yours to set, not the platform's.",
        },
        {
          title: "Tiered no-show and late-cancellation reminders",
          detail:
            "Automated SMS and email reminders go out at 48 hours and again 2 hours before the appointment, each with a one-tap confirm or reschedule link. The cadence is built around your salon's no-show patterns rather than whatever a rented tool happens to offer, closing the gaps a manual reminder routine always leaves open.",
        },
        {
          title: "Colour and treatment recall",
          detail:
            "The system reads each client's history and nudges them at the right moment for their service: a root-tint client around six weeks, a gel-infill client around three, a facial or injectable client at their recommended interval. One-off visits turn into a predictable rebooking rhythm with no one watching a spreadsheet.",
        },
        {
          title: "Patch-test and consent gating for aesthetics",
          detail:
            "For colour, lash, brow and injectable services the booking flow will not confirm until the required patch test or consent form is completed and timestamped against the client record. You stay compliant and insured without chasing paperwork on the day, and the records stay in a system you own rather than a vendor's.",
        },
        {
          title: "Win-back for lapsed regulars",
          detail:
            "When a client who used to come every six weeks has not booked in twelve, they automatically receive a warm, on-brand message inviting them back. You recover revenue from regulars who simply drifted rather than chose to leave, and the message goes out under your salon's name, not a marketplace's.",
        },
        {
          title: "Smart waitlist fill",
          detail:
            "When a cancellation opens a slot, the system offers it straight to waitlisted clients who wanted that stylist or that time, holding it with a deposit when they accept. A gap closes itself within minutes instead of sitting empty all afternoon.",
        },
      ],
      elements: [
        {
          title: "Your own branded booking front-end",
          detail:
            "A booking page that looks and feels like your salon, with your photography, your service menu and your stylists, living on your own domain. Clients book you directly rather than finding a marketplace listing wedged in beside every competitor in your postcode.",
        },
        {
          title: "Stylist-aware online booking with deposits",
          detail:
            "Clients book a specific practitioner, service and duration, pay a deposit through your own account, and see only the genuine availability for that chair. Multi-stylist rotas, room turnaround and processing time for colour are handled properly rather than approximated.",
        },
        {
          title: "Client records, formulas and treatment history",
          detail:
            "One private card per client holding colour formulas, patch-test dates, allergies, treatment notes and before-and-after photos, owned by you and exportable on your terms, not locked inside a booking vendor's database.",
        },
        {
          title: "Digital intake and consent forms",
          detail:
            "Consultation, medical-history and consent forms completed before the appointment and stored against the client record, ready for aesthetics work and the documentation your insurer expects, with nothing to print, scan or chase.",
        },
        {
          title: "Client portal for rebooking and history",
          detail:
            "Regulars log in to rebook their usual service with their usual stylist in seconds, review past appointments and manage their deposits, instead of phoning during your busiest hour or waiting on a marketplace to put them in front of you again.",
        },
      ],
      opportunities: [
        {
          title: "Stop renting your own clients back",
          detail:
            "Once a client has been to you once, owning the booking, reminders and recall means every repeat visit is unambiguously yours. There is no marketplace standing between you and a regular you have already won, and that loyalty compounds across a full book rather than being re-introduced to you as a lead.",
        },
        {
          title: "Add chairs and locations without a rising software tax",
          detail:
            "Because the system is yours rather than billed per practitioner, taking on a new stylist or opening a second site adds capacity without adding a per-seat subscription that grows faster than your team. The tooling stops being something that gets more expensive every time you succeed.",
        },
        {
          title: "Own the data that drives retention",
          detail:
            "With every formula, interval and visit in a system you can actually query, you can see which services and stylists retain clients best and build packages, memberships and loyalty around real numbers. That is decision-making on your own data, not guesswork on a platform that only shows you what it chooses to.",
        },
      ],
      opsTrap:
        "Marketplace and rented booking tools are built around the platform's interests, not yours. They want as many of your bookings as possible classed as theirs, and they make each client relationship feel like it belongs to the software rather than to your salon. So you end up shaping your service menu, your deposit rules and even your opening availability around what the tool allows, treating hard-won regulars as new-client leads over and over, and storing your colour formulas and consent records inside a vendor's database you cannot fully control. A bespoke system you own flips that. Your clients are plainly yours, your booking and payments run through your own accounts, your formulas and consent history stay in your hands and export cleanly, and the software stops being a monthly cost that climbs every time you add a chair. You own the system and subscribe only to the results it produces.",
    },
    trades: {
      id: "trades",
      diagnosis:
        "You are running the whole business out of ServiceM8, Jobber or Tradify, you are listed on Checkatrade or MyBuilder for leads you cannot always trace to real work, and you take card payments through a reader that sits between you and your own money. Quotes, job sheets, certificates and invoices live in separate rented tools that do not talk to each other, so you re-key the same job address and customer details three or four times, your entire job history sits inside a platform you do not own, and you are chasing deposits and sign-offs by text on a Friday night because nothing chases for you.",
      saasToCut: [
        {
          name: "ServiceM8 / Jobber / Tradify",
          note: "Field-service platforms built to one generic shape of trade business — their idea of a job, their quote template, their workflow. Add a fitter or a second van and you are deeper into a system you rent, with your entire job and customer history held inside their database rather than yours.",
        },
        {
          name: "Checkatrade / MyBuilder / Rated People",
          note: "Directory listings that rent you access to your own market — you compete on a page that ranks your rivals right beside you, chase enquiries that never convert, and build no asset of your own because the customer belongs to the directory, not to you.",
        },
        {
          name: "Commusoft / Joblogic / Powered Now",
          note: "Job-management and quoting suites where the genuinely useful parts — recurring jobs, multi-engineer scheduling, custom forms — sit behind the upper tiers, and your certificates and job records are formatted to their system, locked to their export, not a structure you control.",
        },
        {
          name: "NICEIC Certsure / Clik Cert certificate tools",
          note: "Separate certification software bolted on beside everything else, so a Part P, EICR or Gas Safe record is produced in one tool, the job lives in another, and nothing files it automatically against the customer it belongs to.",
        },
        {
          name: "Square / SumUp / Zettle card readers",
          note: "A third party sits between the customer's card and your bank, on their payout timetable and their rules, taking a cut of every deposit and final payment instead of the money landing in an account you own outright.",
        },
        {
          name: "GoCardless / platform-routed billing",
          note: "When deposits and direct debits run through someone else's account rather than your own Stripe, you inherit their payout schedule and their terms, and the payment relationship with your customer is theirs to hold, not yours.",
        },
      ],
      automations: [
        {
          title: "Deposit-gated booking",
          detail:
            "A job slot is only held once the customer has paid a deposit through your own Stripe, so no-shows and time-wasters never reach the diary and a confirmed booking is genuinely confirmed.",
        },
        {
          title: "Quote-to-job conversion",
          detail:
            "An accepted quote turns itself into a scheduled job with the materials list, site address and assigned fitter already filled in — no re-typing the same details between a quoting tool and a diary.",
        },
        {
          title: "Appointment and on-our-way alerts",
          detail:
            "The customer gets an automatic reminder the day before and a message when the van leaves the last job, cutting the locked-door wasted visits that swallow a half-day of margin.",
        },
        {
          title: "Certificate and compliance follow-through",
          detail:
            "On completion the system issues the right certificate or warranty — Part P, EICR, Gas Safe, FENSA — and files a copy against the property record, so a notifiable job is never stuck on someone's phone.",
        },
        {
          title: "Staged invoicing that chases itself",
          detail:
            "Final and staged invoices raise the moment a job is signed off and follow up on their own schedule until paid, so you stop carrying finished work unpaid for weeks while you are out on the next one.",
        },
        {
          title: "Service and recall reminders",
          detail:
            "Annual boiler services, landlord safety checks and warranty inspections prompt the customer automatically twelve months on, turning a one-off install into a booking that comes back without you remembering.",
        },
      ],
      elements: [
        {
          title: "Trade site with online booking and deposits",
          detail:
            "A front end that shows your work and accreditations and lets a customer request or book a job with a deposit taken straight into your own Stripe — an enquiry that lands with you, not a directory.",
        },
        {
          title: "Job and property records you own",
          detail:
            "Every property, job history, certificate and before-and-after photo held in one record you control outright, so the next visit to that address starts with the full history already in front of you.",
        },
        {
          title: "On-site job sheets and sign-off",
          detail:
            "Digital job sheets, site-survey forms and customer sign-off captured on a phone at the property and saved against the job, replacing paper dockets and a phone full of WhatsApp photos.",
        },
        {
          title: "Customer and landlord portal",
          detail:
            "A simple area where a homeowner, landlord or letting agent can approve quotes, download certificates and invoices, and pay — without ringing the office or losing the paperwork.",
        },
        {
          title: "Payments through your own Stripe",
          detail:
            "Deposits, staged payments and final invoices settle into an account you own, with no platform sitting in the middle of your money or holding the relationship with your customer.",
        },
      ],
      opportunities: [
        {
          title: "Own your lead source",
          detail:
            "Once enquiries come through your own site and your own past customers rather than a paid directory, every repeat job and referral is yours to keep, and you stop renting access to a market you have already built.",
        },
        {
          title: "Recurring maintenance and safety contracts",
          detail:
            "With recall and service reminders built into a system you own, you can sell annual service plans and landlord safety contracts that bring steady, predictable work between the big installs.",
        },
        {
          title: "Add vans and fitters without re-renting",
          detail:
            "Because the system belongs to you and is not shaped around a per-seat model, taking on another fitter or a second crew adds capacity to a system you already own, instead of pushing you onto a bigger plan.",
        },
      ],
      opsTrap:
        "Generic field-service software picks a shape of business for you — its idea of a job, its quote template, its payment flow, its lead market — and you spend years bending your actual trade to fit it, with your certificates, your customer relationships and your payment flow all held inside a platform you only rent. A system built around how your trade really runs reverses that: your staged payments, your certificate set, your repeat-service cycle, your records, all in one place that belongs to you, so the tool adapts to the business instead of the business contorting around the tool. Booking a call gets you a tailored consultation where we map your exact workflow and current stack before anything is built.",
    },
    hospitality: {
      id: "hospitality",
      diagnosis:
        "You are running a room you do not control. OpenTable and SevenRooms hold your reservation diary, DesignMyNight (Collins) sits between you and your own event and party enquiries, and Square owns the till, the online orders and the card terminal. Your guest history, your no-show patterns, your regulars' birthdays and their usual table all live inside platforms you rent and can never take with you. Every cover you seat quietly deepens your dependence on software built for the network's diary, not your floor plan.",
      saasToCut: [
        {
          name: "OpenTable",
          note: "Holds your bookings inside its marketplace and pushes diners to you through its own app, so the relationship with the guest belongs to the network rather than to your venue.",
        },
        {
          name: "SevenRooms",
          note: "A reservation and guest-CRM platform where your richest guest data and marketing tools sit behind tiers you must keep renting to use, and which you cannot export and own outright.",
        },
        {
          name: "ResDiary",
          note: "Another rented diary and table-management layer that dictates how your bookings, slots and covers are structured, forcing your front-of-house to work the software's way rather than your room's.",
        },
        {
          name: "DesignMyNight (Collins)",
          note: "Sits between you and your own enquiries, deposits and pre-paid events, routing diners who were trying to book you direct through a marketplace you do not control.",
        },
        {
          name: "Square",
          note: "Owns your till, card terminal and online ordering as a closed stack, with loyalty, marketing and ordering bolted on as separate modules you rent rather than systems you own.",
        },
        {
          name: "Mailchimp",
          note: "Your guest list lives in a separate marketing tool, disconnected from your diary, so your regulars sit in one silo and your bookings in another and neither truly belongs to you.",
        },
      ],
      automations: [
        {
          title: "Deposit-backed booking confirmations",
          detail:
            "Larger parties and peak slots automatically take a card deposit or hold at the point of booking through your own Stripe, so a no-show costs the guest rather than your covers and your busiest services are protected.",
        },
        {
          title: "Timed no-show and reminder sequence",
          detail:
            "Each booking triggers a confirmation, a day-before reminder and a same-day nudge by SMS or email, with a one-tap cancel link that releases the table back into your diary the moment a guest can no longer make it.",
        },
        {
          title: "Waitlist that fills cancellations",
          detail:
            "When a table is released the system offers it straight to waitlisted guests in order, turning a gap on a fully-booked night into a recovered cover without a host phoning round the list.",
        },
        {
          title: "Quiet-service and last-table offers",
          detail:
            "The system spots a soft midweek service or unsold early slots and sends a targeted offer to nearby regulars, pulling bookings into the exact times you need to fill instead of leaving the room half-empty.",
        },
        {
          title: "Post-visit follow-up and review routing",
          detail:
            "A day after the meal guests receive a thank-you that invites happy diners to leave a public review and routes any complaint privately to you first, so problems reach the manager before they reach the internet.",
        },
        {
          title: "Event and private-hire enquiry handling",
          detail:
            "Function and private-hire enquiries are captured, acknowledged instantly with availability and a deposit link, and tracked all the way to a confirmed booking, so nothing slips through a shared inbox.",
        },
      ],
      elements: [
        {
          title: "Direct booking on your own site",
          detail:
            "A reservation flow built into your own website that takes the booking and the deposit through your account, so guests book you direct and no marketplace stands between you and your own diner.",
        },
        {
          title: "Guest records you own",
          detail:
            "Every diner's history, allergies, seating preferences, spend and no-show record held in one database that belongs to you outright, not rented back to you tier by tier and lost the day you leave the platform.",
        },
        {
          title: "Deposits and payments through your Stripe",
          detail:
            "Deposits, pre-paid events and gift vouchers settle straight into your own Stripe account, with no marketplace and no third party sitting between the guest's card and your bank.",
        },
        {
          title: "Function and private-hire portal",
          detail:
            "A dedicated space where event guests confirm numbers, choose menus, sign off pre-orders and settle balances, replacing the email-and-spreadsheet scramble that runs most private hire.",
        },
        {
          title: "Service-floor diary view",
          detail:
            "A clean run-sheet of the night built for the pass and the host stand — covers, timings, deposits taken and dietary notes — designed around how your room actually turns tables rather than how a rented diary lays them out.",
        },
      ],
      opportunities: [
        {
          title: "Own the guest relationship, not rent it",
          detail:
            "With every diner's contact and history in your own system you can fill quiet services, run a regulars' list and bring people back directly, instead of paying a platform to reach guests you already earned.",
        },
        {
          title: "Turn private hire and events into a real revenue line",
          detail:
            "A proper enquiry-to-deposit pipeline lets you chase, convert and upsell functions reliably, capturing the high-margin party and event bookings that currently leak away in a cluttered inbox.",
        },
        {
          title: "Open a second site on the same system",
          detail:
            "Because the platform is yours, a new venue runs on the same booking, deposit and guest engine you already own, so growth adds covers and revenue instead of stacking up another rented diary.",
        },
      ],
      opsTrap:
        "Reservation platforms are built for the network's diary, not your room. They decide what guest data you are allowed to see, push diners through a marketplace that sits between you and people trying to book you direct, and force your front-of-house to bend around the software's table logic instead of your own floor plan. A bespoke system inverts that: the booking flow, the deposit rules and the guest history are modelled on how your venue actually seats and turns tables, the data stays yours to market to and walks with you, and a full Saturday builds your business rather than the platform's. You own the system that runs your covers instead of renting it back one service at a time.",
    },
    professional: {
      id: "professional-services",
      diagnosis:
        "You are running a practice on a stack of rented, per-seat tools that you do not own. Clio or Karbon holds your matters and workflow, Ignition handles proposals and engagement, Calendly takes consultations, HubSpot runs the pipeline, and a separate intake form and e-signature tool are bolted on top. Every fee-earner you hire is another licence to buy. Your client data is scattered across four or five logins that do not talk to each other, so the same name and matter get re-keyed by hand. And the bill arrives every month whether the work came in or not — you are renting the system your whole practice depends on, and you cannot take it with you.",
      saasToCut: [
        {
          name: "Clio / Karbon (practice & matter management)",
          note: "Your matters, time and workflow live inside someone else's platform on a per-fee-earner licence. The deeper automation and accounting sit on the higher tiers, your data is theirs to host, and a clean export the day you leave is deliberately awkward.",
        },
        {
          name: "Ignition (proposals & engagement)",
          note: "Engagement letters, scope and recurring billing run through their flow and their branding, with payments routed via their rails — the client's first impression of your firm is rented, not owned.",
        },
        {
          name: "Calendly",
          note: "Once you need consultation routing, multiple meeting types and reminders it becomes another per-user line, and it still drops the prospect on a generic page that knows nothing about the matter or the conflict position.",
        },
        {
          name: "HubSpot",
          note: "The free CRM is the hook; sequences, reporting and extra seats are where it bites as your contacts and team grow, and it models everything as a 'deal' rather than a matter, an engagement or a retainer.",
        },
        {
          name: "PandaDoc / Proposify (proposals & onboarding)",
          note: "Yet another subscription for documents that should simply be part of your matter — proposals and onboarding flows sitting in their cloud, behind their login, separate from where the work actually happens.",
        },
        {
          name: "DocuSign",
          note: "Routine engagement letters, consents and AML declarations are metered through a third party, so the paperwork every instruction depends on is one more recurring contract you do not control.",
        },
      ],
      automations: [
        {
          title: "Engagement letter to matter open",
          detail:
            "When a client accepts the proposal and signs the engagement letter, the system opens the matter, creates the client record, runs the conflict and ID checks, and files the executed letter against the matter automatically — nothing re-keyed across four tools.",
        },
        {
          title: "Consultation booking with intake attached",
          detail:
            "A booked consultation takes the deposit, issues the intake and conflict-check form, and lands in your diary already populated with the matter type, the responsible fee-earner and the client's answers — no blank slot to chase later.",
        },
        {
          title: "AML and KYC chasing",
          detail:
            "The system requests proof of identity and source-of-funds at onboarding, chases what is outstanding on a schedule, blocks work from starting until checks clear, and flags any client whose verification is due to be refreshed.",
        },
        {
          title: "Time, fixed fees and disbursements to invoice",
          detail:
            "Recorded time, agreed fixed fees and disbursements roll into a draft bill on your billing cycle, ready for review and sent for payment into your own account — no end-of-month reconstruction from notes and spreadsheets.",
        },
        {
          title: "Deadline and limitation tracking",
          detail:
            "Filing deadlines, limitation periods, statutory dates and review dates generate staged reminders to the responsible fee-earner and their supervisor, so nothing critical ever rests on a single diary entry.",
        },
        {
          title: "Matter close and recall",
          detail:
            "When a matter closes the client receives a clear outcome and next-step note, the file is archived to your retention rule, and the client is scheduled for the right recall — an annual accounts review, a will review, a lease renewal — without anyone having to remember.",
        },
      ],
      elements: [
        {
          title: "Secure client portal",
          detail:
            "One branded, UK-hosted place where clients track their matters, upload documents, approve drafts and settle bills — replacing email threads, password-protected PDFs and third-party file-sharing links.",
        },
        {
          title: "Intake and conflict-check forms",
          detail:
            "Structured forms that capture the facts you need, run the conflict and KYC checks and write straight into the matter record, instead of arriving as another email to copy out by hand.",
        },
        {
          title: "Proposals and engagement letters",
          detail:
            "Branded, scoped proposals and engagement letters a client can read, sign and pay against in one flow on your own domain, with the executed copy stored against the matter from the moment it is signed.",
        },
        {
          title: "Payments through your own account",
          detail:
            "Deposits, fixed fees and invoices are taken straight into your own Stripe and your own client and office accounts — no platform sitting in the middle of your money or your client relationship.",
        },
        {
          title: "Matter and document records you own",
          detail:
            "A single record per client and matter — correspondence, documents, time, deadlines, disbursements and status — held in a system you own outright and can keep, export or migrate entirely on your terms.",
        },
      ],
      opportunities: [
        {
          title: "Add fee-earners without adding licences",
          detail:
            "Because the system is yours and not priced per seat, you can bring on associates, paralegals, advisers or consultants without your software bill climbing in step with the team — you hire when the work justifies it, not when the licence forces it.",
        },
        {
          title: "Productised and retainer services",
          detail:
            "Owning the booking, intake and billing flow lets you package fixed-fee and recurring-retainer work — annual reviews, ongoing advisory, subscription bookkeeping, a fixed-price will or incorporation — with the onboarding handled automatically every time.",
        },
        {
          title: "Referrals, second offices and a partner network",
          detail:
            "A portal and pipeline you control make it straightforward to add referral routes, open a second office or bring on consultant partners — extending your own system rather than re-buying and re-configuring someone else's.",
        },
      ],
      opsTrap:
        "Generic practice and CRM tools force you to describe professional work in their vocabulary — their idea of a 'deal stage', a 'contact', an 'envelope' — when your work actually moves through engagement, conflict checks, matters, deadlines, disbursements and recall. So the real picture ends up living in spreadsheets and in people's heads, while you keep paying per seat for software that only half-fits. A bespoke system is built around how your practice genuinely runs, holds the whole client relationship in one place you own outright, and bends to your process instead of making you bend to it — own the system, and cut the bill.",
    },
    retail: {
      id: "retail-ecommerce",
      diagnosis:
        "You are running your shop on Shopify, Square or Wix, with a stack of paid apps bolted on for everything the platform leaves out — reviews, loyalty, subscriptions, bundles, back-in-stock. Your products, variants, stock levels, customer list and checkout all live inside someone else's account. The platform, not you, decides how your checkout behaves, which fields you can capture and how your storefront looks, and every new capability means renting yet another app on top. The more you sell, the more of your operation you are renting back from tools that were never built for the way your shop actually works.",
      saasToCut: [
        {
          name: "Shopify (plus the App Store)",
          note: "The platform handles the basics, then leaves you renting a stack of apps for the rest — Recharge for subscriptions, Yotpo or Judge.me for reviews, Back in Stock, bundle and upsell apps — each a separate login, each one more piece of your shop you do not own.",
        },
        {
          name: "Square / Square Online",
          note: "Your till, online store, loyalty, marketing and gift cards are split across separate Square add-ons that only loosely talk to each other, so your in-person and online sales never live in one place you control.",
        },
        {
          name: "Wix or Squarespace Commerce",
          note: "Your storefront is locked to their templates, their hosting and their checkout, with little say over how the basket behaves or what you can capture at the point of sale — you bend your shop to fit the builder, not the other way round.",
        },
        {
          name: "Lightspeed Retail (formerly Vend)",
          note: "Your EPOS, stock, purchasing and loyalty are carved into separate licensed modules tied to each register and location, so adding a till or a shop floor means renting more of the same software you already depend on.",
        },
        {
          name: "Klaviyo or Mailchimp",
          note: "Your email and SMS marketing — abandoned baskets, flows, win-backs — sits in a tool that holds your customer list hostage, gated and throttled the larger your audience grows, which is exactly the audience you are working to build.",
        },
        {
          name: "Gorgias or Zendesk",
          note: "Your 'where is my order' support lives in yet another rented helpdesk that has to be wired back into the store, the courier and the customer record it should have been part of from the start.",
        },
      ],
      automations: [
        {
          title: "Abandoned-basket recovery from your own store",
          detail:
            "When a shopper adds to basket and leaves, your own system follows up by email or text with the exact items they left and a one-tap return to checkout — no third-party recovery app sitting between you and the sale it brings back.",
        },
        {
          title: "Back-in-stock and low-stock alerts",
          detail:
            "Shoppers who hit a sold-out size, colour or product are notified the moment that exact variant is restocked, and you get an early warning before a bestseller drops to zero, all driven straight from your own live stock levels.",
        },
        {
          title: "Post-purchase review and reorder prompts",
          detail:
            "A follow-up asks for a review once the order has had time to arrive, then later nudges buyers of consumables and refills to reorder the same items — your own first-party reviews and repeat sales, with no reviews app in the loop.",
        },
        {
          title: "Order, dispatch and tracking updates",
          detail:
            "Confirmation, dispatch and delivery messages fire automatically off each order's real status and courier tracking, so customers stop opening tickets to ask where their parcel is.",
        },
        {
          title: "Win-back for lapsed customers",
          detail:
            "Anyone who has not bought within a set window is segmented by what they previously purchased and sent a tailored offer, run entirely from your own customer and order history rather than a rented marketing list.",
        },
        {
          title: "Stock, fulfilment and bookkeeping sync",
          detail:
            "Every sale, refund and stock movement flows straight from the shop floor and the website into one set of records and into your accounts, ending the manual CSV exports and the rented connector apps that stitch it together today.",
        },
      ],
      elements: [
        {
          title: "Storefront and checkout you own",
          detail:
            "A fast, fully branded shop front built around how you actually sell, with the basket and a checkout you control end to end — the flow, the fields you capture, the upsells — running on your own system rather than a platform's locked template.",
        },
        {
          title: "Payments straight into your own Stripe",
          detail:
            "Card, Apple Pay and Google Pay settle directly into your own Stripe account, owned by you, with the money and the customer record landing in your system instead of being routed through a platform that sits in the middle.",
        },
        {
          title: "Products, variants, stock and orders in one place",
          detail:
            "A single system for products, variants and SKUs, live stock across online and in-person sales, and every order from placed to dispatched to refunded — without splitting it across separate till, store and stock subscriptions.",
        },
        {
          title: "Customer accounts and order history",
          detail:
            "A portal where customers track orders, reorder past purchases in a tap and manage their own details, with their full history held in your system rather than a platform you rent access to.",
        },
        {
          title: "Your customer and product data, yours to keep",
          detail:
            "Every customer, order and product sits in a database you own and can export or move at will, lifted out of your current platform once so your shop is never again held hostage by the tool it happens to run on.",
        },
      ],
      opportunities: [
        {
          title: "More of every sale stays yours",
          detail:
            "With the platform out of the middle and the rented app stack gone, the full value of each order — and the customer behind it — stays inside a system you own, and that advantage compounds as your volume grows instead of being clawed back the bigger you get.",
        },
        {
          title: "New sales channels without renting more apps",
          detail:
            "Because you own the system, adding wholesale ordering, a trade price tier, subscriptions or click-and-collect is a feature you build once, not another app or platform plan to rent for each one.",
        },
        {
          title: "Marketing driven by data you fully control",
          detail:
            "With complete first-party customer and purchase history in your own system, you can segment and target repeat-purchase, win-back and lifetime-value campaigns however you like, never capped or gated by what an external marketing tool will let you reach.",
        },
      ],
      opsTrap:
        "Generic shop platforms are built for the average of every seller, so you end up shaping your products, bundles, pricing tiers, checkout and fulfilment around what the template and its apps will allow — then renting yet another add-on every time you need to bend it back. A system built for how your shop actually sells does the opposite: the software fits your operation rather than forcing your operation into the software, you stop renting your storefront, your checkout and your customer list back from someone else, and you finally own the way your business sells online and in person.",
    },
    default: {
      id: "general-small-business",
      diagnosis:
        "You are running the whole business across a stack of separate subscriptions that were never built to work together — a website builder, a booking or enquiry tool, a CRM, an email and newsletter app, an invoicing tool and a card reader — so the same customer is typed in fresh in every one. A new enquiry gets keyed into the CRM, again into the booking tool, again into the mailing list and again when you raise the invoice. You rent every one of them, your staff each need their own login, and you still own none of it: the day you stop paying, the site goes dark, and getting your customer list, your bookings and your history out cleanly is made deliberately hard. You are not running a business so much as operating six apps that happen to point at the same customers.",
      saasToCut: [
        {
          name: "Squarespace / Wix / GoDaddy Website Builder",
          note: "You are renting the shop window. Stop paying and it goes dark, and the export tools are built to make leaving harder than staying — so you never quite own the thing customers find you through.",
        },
        {
          name: "HubSpot / Pipedrive / Zoho CRM",
          note: "The features you actually need — automation, proper reporting, more than a handful of contacts — sit behind tiers you are pushed up as you grow, and every staff member needs their own login.",
        },
        {
          name: "Calendly / Acuity / Setmore (booking & enquiries)",
          note: "Deposits, intake forms, reminders and team calendars are gated behind the upper plans, and the booking flow bends your process to fit theirs rather than the other way round.",
        },
        {
          name: "Mailchimp / Constant Contact (email marketing)",
          note: "A separate silo holding a copy of contacts you already own, walled off from your CRM and your bookings, so the same person exists three times and you market in the dark.",
        },
        {
          name: "QuickBooks / Xero / FreshBooks (invoicing)",
          note: "Yet another login that does not know a customer exists until you re-type their details by hand, with chasing overdue invoices left as a manual job you keep forgetting to do.",
        },
        {
          name: "Stripe / PayPal / Square (payments)",
          note: "The card rails themselves are fine — the problem is that payments live in a sealed-off tool that does not write back to the customer's record, so the money and the relationship never meet.",
        },
      ],
      automations: [
        {
          title: "One customer record, written once",
          detail:
            "A new enquiry creates a single record that carries through quote, booking, payment and follow-up — so nobody ever re-types the same name, number and email into four different tools again.",
        },
        {
          title: "Enquiries answered the moment they land",
          detail:
            "A web enquiry or message triggers an instant acknowledgement and a tidy follow-up, so a lead never sits unseen in an inbox while a competitor replies first.",
        },
        {
          title: "Quotes and bookings that confirm themselves",
          detail:
            "A customer accepts a quote or books a slot online, an optional deposit lands in an account in your own name, and it is confirmed without a single phone call or back-and-forth email.",
        },
        {
          title: "Reminders before every appointment or deadline",
          detail:
            "Text and email reminders go out on a schedule you set, cutting no-shows and chased deadlines without you having to remember to chase anyone.",
        },
        {
          title: "Invoicing and payment-chasing on autopilot",
          detail:
            "Invoices raise themselves from the same record once work is done, and polite reminders go out automatically when one runs late, so you stop being your own debt collector.",
        },
        {
          title: "Reviews, referrals and quiet-period recall",
          detail:
            "After a completed job the system asks happy customers for a review or referral, and when the diary looks thin it reaches back to people you have not seen in a while with a tailored nudge to return.",
        },
      ],
      elements: [
        {
          title: "A website front-end built around how you actually sell",
          detail:
            "A fast, search-friendly site shaped to your services and your customers, not bent to fit a template's idea of what a business is supposed to look like.",
        },
        {
          title: "One customer record that everything writes to",
          detail:
            "Enquiries, quotes, bookings, notes, payments and history live in one place you own — the CRM, the booking tool, the mailing list and the invoicing app collapsed into a single record.",
        },
        {
          title: "Online booking and quote acceptance, in your name",
          detail:
            "Customers book, accept quotes and pay any deposit into a payment account that belongs to you, so the cash and the relationship are yours from the first click rather than routed through a platform you rent.",
        },
        {
          title: "Intake and consent forms tied to the record",
          detail:
            "Customers complete the details and permissions you need up front, filed against their record automatically, so nothing is re-keyed and nothing is lost.",
        },
        {
          title: "A customer portal for repeat business",
          detail:
            "Regulars log in to rebook, view their history, see past invoices and update their own details — which cuts your admin and keeps them coming back to you directly.",
        },
      ],
      opportunities: [
        {
          title: "Growing the team stops growing the software bill",
          detail:
            "With a system you own outright, taking on your fifth or tenth member of staff is just another login you create — not another per-head charge stacked onto a stack of subscriptions.",
        },
        {
          title: "Your customer data finally becomes an asset you can act on",
          detail:
            "Because every enquiry, booking, payment and contact lives in one system you control, you can see who your best customers are and market to them directly, instead of renting fragmented access to lists held in someone else's silos.",
        },
        {
          title: "One system, one source of truth, decisions you can trust",
          detail:
            "When sales, bookings and invoicing all read from the same record, the numbers finally agree — so you can plan around what is really happening rather than reconciling six tools by hand.",
        },
      ],
      opsTrap:
        "Every generic tool quietly forces a compromise. You take bookings the way Calendly allows, you describe your services in the boxes Squarespace hands you, you raise invoices in a tool that has never heard of the customer, and you re-key the same person into your CRM, your mailing list and your card reader because none of them were built to share. You end up running your business the way six separate apps happen to work, renting every one of them, and still owning nothing you could walk away with. A bespoke system you own outright is built around your operation instead — one place, your rules, your data, your accounts in your name, and nothing you have to keep paying for the right to keep using. This prospectus is the starting sketch; the exact build and the numbers are set with you on a call.",
    },
  },
  pains: [
    {
      id: "noshows",
      fix: "Capture every booking, even after hours",
      detail:
        "Your own booking and enquiry flow runs on your site and takes appointments around the clock, so calls you miss never become bookings you lose.",
    },
    {
      id: "reminders",
      fix: "Reminders and rebooking that run themselves",
      detail:
        "A system you own can send confirmations, reminders and rebooking prompts automatically from your own records, instead of you doing it by hand or paying per message in a rented tool.",
    },
    {
      id: "tools",
      fix: "One system instead of a stack of subscriptions",
      detail:
        "We fold the jobs you currently spread across several paid tools into a single bespoke system you own, so the work joins up and the monthly subscriptions stop.",
    },
    {
      id: "payments",
      fix: "Take payment through your own account",
      detail:
        "Payments run straight through your own payment account at a fraction of the cut a rented platform takes, with deposits and balances handled inside the system rather than chased by hand.",
    },
    {
      id: "records",
      fix: "Your records, structured around how you work",
      detail:
        "Client records, notes and forms live in a system shaped to your business and owned by you, so the data stays yours to keep and export rather than locked inside someone else's platform.",
    },
    {
      id: "admin_overload",
      fix: "Cut the manual admin at the source",
      detail:
        "We map where your time disappears and automate the repetitive steps inside one owned system, so the busywork shrinks instead of being shuffled between apps.",
    },
    {
      id: "nothing",
      fix: "A clear picture before you commit to anything",
      detail:
        "Even if nothing is on fire, owning your system means no per-seat fees creeping up and no operations bent to fit a generic tool, and a call simply shows you what that would look like for you.",
    },
  ],
  goals: [
    {
      id: "new",
      approach:
        "We build you a website from scratch that you own outright, designed around how your business actually runs rather than squeezed into a template you rent.",
    },
    {
      id: "redesign",
      approach:
        "We rebuild what you have into a faster, sharper site you own, keeping what works and removing the recurring platform fees underneath it.",
    },
    {
      id: "branding",
      approach:
        "We shape a clear brand and identity that is yours to keep, then carry it through every part of the system we build so it works as hard as it looks.",
    },
    {
      id: "ongoing",
      approach:
        "We build the system and run it for you as an ongoing partner, so you get the benefit of an owned platform without having to maintain it yourself.",
    },
    {
      id: "optimise",
      approach:
        "We map your day-to-day operations and replace the manual steps and scattered tools with one bespoke system you own, so the admin runs itself rather than running you.",
    },
  ],
  spendBands: [
    {
      id: "under50",
      framing:
        "Under £50 a month looks small, but it is still rent you pay forever for tools you will never own, and it tends to climb quietly as you add features and seats; an owned system turns that ongoing outgoing into something you keep.",
    },
    {
      id: "50to150",
      framing:
        "At £50 to £150 a month you are spending well over a thousand pounds a year to rent the software that runs your business, with nothing to show for it at the end; owning one bespoke system replaces that rent with an asset that is yours.",
    },
    {
      id: "150to400",
      framing:
        "£150 to £400 every month adds up to several thousand pounds a year flowing out to platforms you do not control, often for features you barely use; consolidating into a system you own puts that money and that control back with you.",
    },
    {
      id: "400plus",
      framing:
        "At £400 or more a month, usually because you are charged per seat or per practitioner, your bill grows every time you grow; an owned system removes that per-seat penalty so expanding your team no longer means expanding your software bill.",
    },
    {
      id: "unsure",
      framing:
        "Not knowing the total is the most common answer, and it usually means the true figure is higher than you would expect once every subscription and transaction cut is added up; a short call maps exactly what you are renting today and what owning it instead would change.",
    },
  ],
  heroPlans: [
    {
      verticalId: "clinic",
      painId: "noshows",
      title: "The No-Show-Proof Clinic: A System You Own, Not a Diary You Rent",
      narrative:
        "Right now your clinic runs on a per-seat practice-management platform, the kind where you pay for a fresh login the moment a new osteopath, physio or therapist joins, and where online booking, two-way reminders and card payments are bolt-ons you switch on inside someone else's software. The booking rules, the reminder cadence, the note templates and the payment rail are all set by the platform, so your front desk shapes its day around the tool instead of the tool shaping itself around your clinic. The pain you named, no-shows, sits right at the centre of that compromise. A patient who quietly doesn't arrive is a clinician sitting idle in a room you are paying for, a slot you could have given to someone on the waiting list, and revenue that never comes back, while the reminders meant to prevent it are rationed by whatever your plan happens to bundle. Tools like Cliniko, Jane App, Nookal, TM3 / PPS and Power Diary all work this way: they charge by the practitioner and they keep your patient notes, your payment relationship and every account inside their database, on their terms.\\n\\nWe would replace that rented stack with a single bespoke system you own outright, built around how your clinic actually treats people. The centre of it is deposit-backed booking that closes the door on no-shows. Every appointment is held with a deposit or prepayment taken through your own Stripe account, then captured or refunded automatically against your cancellation window, so a missed slot stops costing you a clinician's hour for nothing and the patients who do book are the ones who turn up. Around that sits two-way confirmations and reminders on the cadence you set, each with a one-tap reschedule link so a wobble becomes a moved appointment rather than an empty room; automatic recall when a course of physio or osteo care lapses or a review falls due; digital intake and consent completed before the first visit instead of on a clipboard in the waiting room; and itemised insurer and self-pay invoicing generated without your front desk retyping a thing. Card payments settle into your own merchant account rather than passing through a booking tool that sets the rate, your full patient and outcome history lives in a UK-hosted database you can export in one click at any time, and the multi-practitioner diary is yours, so taking on an associate or opening a second site becomes a configuration change rather than another login on the bill.\\n\\nThe real shift is this. Generic practice-management software forces every clinic into one mould, its booking logic, its templates, its reminder schedule, its idea of what a discharge or a recall is, and as you add clinicians and open sites that compromise scales with you while your patient history stays locked behind its walls. A system you own inverts that. The software bends to your clinic, payments flow through your own account, and the records, the patient relationships and every account stay yours to keep and build on. This Free Scaling Plan is an indicative prospectus, not a quote and not a finished plan; it is auto-generated to show what owning your system could look like. Booking a call turns it into the real thing: a tailored, detailed consultation with a professional who maps every part of this to your exact clinic, your real availability, your treatment types, your insurer mix and the way you genuinely run your front desk, so you leave knowing precisely what your owned system would do and how it would be built.",
      highlights: [
        "Deposit-backed booking taken through your own Stripe account, captured or refunded automatically against your cancellation window, so a no-show stops costing a clinician's hour and the patients who book are the ones who show.",
        "Replace the per-seat bill from Cliniko, Jane App, Nookal, TM3 / PPS or Power Diary with one bespoke system you own outright, with no rented login attached to every new pair of hands.",
        "Card payments settle into your own merchant account and your full patient and outcome history lives in a UK-hosted database you can export at any time, so the relationship and the data stay yours.",
        "Add an associate or open a second site as a configuration change on a diary you own, not another subscription tier and a fresh stack of per-seat charges.",
        "Booking a call turns this auto-generated prospectus into a tailored, detailed consultation with a professional who maps every part to your real availability, treatment types and insurer mix.",
      ],
    },
    {
      verticalId: "clinic",
      painId: "admin_overload",
      title:
        "Reclaim the Front Desk: A Clinic System You Own, Built So the Software Runs the Admin — Not Your Reception",
      narrative:
        "Right now your clinic runs on a per-seat practice-management platform — a Cliniko, a Jane App, a Nookal, a TM3/PPS or a Power Diary — and you rent a fresh login for every osteopath, physiotherapist and therapist you take on. Online booking, two-way SMS reminders and card payments are bolt-ons you switch on inside that same tool, so the things that actually fill your diary are features you rent rather than systems you own. That is the real source of the admin overload: the software dictates how you book, chart, recall and get paid, and your front desk bends its entire day around the tool instead of the tool bending around the clinic. Every intake form that needs chasing, every insurer invoice retyped, every no-show followed up, every lapsed treatment plan recalled lands back on a desk that is already full — because the platform was never built to do those things the way you run them.\n\nWe would replace that with one bespoke system you own outright, designed around how your clinic actually works, and retire the rented stack as the new one comes in. Online booking would take a deposit or prepayment through your own account, captured or refunded automatically against your own cancellation window, so empty slots stop quietly burning a clinician's hour. New patients would complete medical history, red-flag screening and consent digitally before they arrive, landing straight on the practitioner's screen rather than on a clipboard at reception. Reminders and recalls would run on the cadence your clinicians actually want, not a plan tier's defaults; itemised insurer and self-pay invoices would generate themselves with the provider, registration and treatment-code references private medical insurers expect; and discharge follow-ups would turn recovered patients into reviews and referrals without anyone chasing by hand. Card payments would settle directly into your own Stripe, with the merchant relationship and the patient money staying yours. Your full patient, payment and outcome history would live in a UK-hosted, GDPR-safe database you control and can export at any time. Adding an associate, or opening a second site, becomes a configuration change rather than another seat to rent.\n\nThe deeper point is this: generic practice-management software forces every clinic into the same mould — its booking rules, its note templates, its reminder cadence, its payment rail, its definition of a recall — and as you grow, that compromise scales with you, a rented login trailing every new pair of hands while your notes stay locked inside someone else's database. Stop forcing your clinic into a tool that was never built for it. A system you own inverts the relationship: the software does the admin, your reception stops servicing the software, and the records, the relationships and the revenue stay yours to keep and build on. This document is a free, indicative prospectus drawn from a few short answers — a considered starting point, not a finished plan. The real value comes on a call, where a professional maps every part of this to your exact clinic — your treatment types, your practitioners, your insurer mix and your sites — and turns this outline into a tailored, detailed consultation built around how you genuinely run. Book that call and you leave with a specific, professional plan for your clinic, not a generic brochure.",
      highlights: [
        "End the per-seat trap: replace Cliniko, Jane, Nookal, TM3/PPS or Power Diary with one bespoke clinic system you own outright, so adding a clinician or opening a second site is a configuration change, not another rented login.",
        "Hand the admin to the system: deposit-backed booking against your own cancellation window, digital history, red-flag screening and consent before the first visit, automatic recalls for lapsed treatment plans, and itemised insurer invoices that generate themselves — the work that currently piles onto your front desk.",
        "Keep the money and the patient relationship: card payments settle directly into your own Stripe, with the merchant relationship and the patient money staying yours rather than routed through a tool you do not control.",
        "Own your records outright: full patient, payment and outcome history in a UK-hosted, GDPR-safe database you control and can export at any time — never gatekept behind a higher plan tier or held hostage by a vendor.",
        "A free prospectus, then a real plan: this outline is indicative; booking a call turns it into a tailored, detailed professional consultation mapped to your exact treatment types, practitioners, insurer mix and sites.",
      ],
    },
    {
      verticalId: "clinic",
      painId: "tools",
      title:
        "Own Your Clinic's Engine: One Bespoke System, Not a Stack of Per-Seat Subscriptions",
      narrative:
        "Right now your clinic runs on rented practice-management software. Whether it is Cliniko, Jane, Nookal, TM3, PPS or Power Diary, the pattern is identical: you pay per active practitioner, so a fresh login lands on the bill the moment you take on an associate, before they have treated a single patient. Worse, the features that actually fill your diary — online booking, two-way SMS reminders, card payments, intake forms, recalls — are switches inside someone else's tool, not systems you control. The software dictates how you book, chart, recall and get paid, and your front desk reshapes its day around the platform instead of the other way round. Every patient note, every booking rule, every reminder cadence and every payment now lives in a database you do not own and cannot fully export. That is the real cost of generic tools: not the monthly line item, but the fact that your booking rules, your charting templates, your recall timing and your entire patient history are all on rent.\n\nWe would replace that rented stack with one bespoke system you own outright, built around how your clinic genuinely runs. A multi-practitioner diary modelled on your real clinicians, rooms, equipment and appointment types. Structured clinical records — body charts, range-of-motion, outcome measures — shaped to how physios, osteopaths and chiropractors actually chart, rather than a generic note field. Online booking that holds a deposit to end no-shows, two-way reminders on your clinic's own cadence, and automatic recall the moment a treatment plan lapses. Digital intake and consent completed before the first visit. Insurer and self-pay invoicing generated with the provider, registration and treatment-code references private medical insurers expect. Card payments settle straight into your own merchant account, so the patient money and the relationship behind it stay yours. Adding a clinician or opening a second site becomes a configuration change on a system you already own — not another login on the invoice and a fresh tangle of subscriptions.\n\nThe thinking underneath this is simple. Generic practice-management software forces every clinic into the same mould, and you have spent years bending your front desk and your clinical workflow to fit a tool that was never designed for the way you treat. As you add practitioners and sites, that compromise scales with you, and your patient history stays locked behind someone else's walls. A system you own inverts the relationship: the software bends to your clinic, the payments flow through your own account, and the records, the patient relationships and the operational know-how stay yours to keep and build on. This document is an indicative prospectus, generated from a handful of short answers — not a quote, and not a finished plan. Booking a call turns it into a tailored, detailed consultation with a professional who will map every part of this to your exact clinic: your real practitioner mix, your insurers, your appointment types and your way of working.",
      highlights: [
        "Stop paying per seat. On a system you own, taking on an associate physio, osteopath or therapist adds treating capacity without a rented login attached to every new pair of hands.",
        "Patient payments settle into your own merchant account, not a booking platform's rail, so the money and the relationship behind it stay with your clinic.",
        "Deposit-backed booking, two-way reminders on your own cadence and automatic recall when a treatment plan lapses fill the diary on your terms, instead of being rationed by a platform's plan tier.",
        "Your full patient and outcome history lives in a database you control and can export at any time — ready for recalls, outcome tracking and referrals that a rented platform would gatekeep.",
        "Booking a call upgrades this prospectus into a detailed, professional consultation mapped to your real clinician mix, rooms, appointment types and insurers.",
      ],
    },
    {
      verticalId: "wellness",
      painId: "tools",
      title:
        "Own Your Timetable: One Bespoke System Instead of Renting Mindbody and ClassPass",
      narrative:
        "Right now the engine that runs your studio is rented. Your timetable, your member list, every booking, rebill and recall lives inside Mindbody, Glofox or TeamUp, under their rules, their app and their roadmap. ClassPass quietly fills your off-peak slots with bargain-hunting drop-ins who rarely return, training your local market to book through a third party rather than join you direct. Your coaches deliver programmes in a separate app such as Trainerize, so a member's class history and their PT history sit in two different places. Memberships bill through the platform's own payment layer, so the recurring relationship and your members' card details live in their system, not an account in your name. And because that platform exports little and automates less, you pay for Mailchimp on top just to send a win-back email. None of the relationships you worked so hard to win were ever really yours to keep.\n\nWe would build you one bespoke system you own outright, designed around how your studio actually runs. A live timetable on your own site where members book and pay for classes, courses and PT slots, with deposits or class credits taken upfront to cut no-shows. Memberships, drop-ins, class packs and PT blocks managed your way, with the credits, freezes, upgrades and renewals your studio really uses rather than the ones a rented app permits. A branded member portal under your name, with PAR-Q and consent captured at sign-up so coaches walk into a first session already knowing the member, and payments settling straight into your own account. On top of that, the automations that keep it full without you watching the clock: recurring billing with automatic dunning to recover lapsed cards, waitlist auto-fill for popular sessions, no-show and late-cancellation handling under your rules, intro-offer and lapsed-member win-back, new-joiner onboarding, and block and class-pack renewal reminders. One system replaces the rented booking platform, ClassPass, the separate coaching app, the platform's payment layer and the bolted-on email tool.\n\nThe deeper point is this: generic studio software forces your business into its mould — its class-credit logic, its membership types, its billing cadence, its app. The moment that model stops matching how you run sessions, blocks or hybrid in-person and on-demand coaching, you bend your operations to fit the software and paper over the gaps with spreadsheets and manual messages. A system you own flips that round. The booking rules, membership structure and member journey are built around your studio; your members, their attendance, spend and lapse patterns stay yours to keep, read and act on; and you stop renting the very engine that runs your timetable. This outline is an indicative prospectus generated from a few short answers, not a quote and not a finished plan. Booking a call turns it into a tailored, detailed consultation with a professional who maps your exact tools, timetable and member journey to a system designed around you.",
      highlights: [
        "Own the engine, do not rent it: replace Mindbody, Glofox or TeamUp with one bespoke system built around your timetable, memberships and blocks, instead of bending your studio to fit theirs.",
        "Take back the off-peak slots ClassPass fills with one-off drop-ins: your own booking, pricing and quiet-hour offers bring in members who join you direct and stay, with the relationship yours from the first class.",
        "Payments and member data stay in your name: memberships, packs and PT blocks settle into your own account, while attendance, spend and lapse patterns become a retention system you control rather than a guess.",
        "Stays full without you watching the clock: recurring billing with automatic dunning, waitlist auto-fill, no-show handling, intro-offer and lapsed-member win-back and renewal reminders, replacing the bolted-on email tool and the separate coaching app.",
      ],
    },
    {
      verticalId: "wellness",
      painId: "noshows",
      title:
        "No-Show Defence: A Booking System You Own, Built Around How Your Studio Runs",
      narrative:
        "Right now your timetable, your members and every class booking live inside a rented platform like Mindbody, Glofox or TeamUp. Payments run through their billing layer, and a separate tool such as Mailchimp is bolted on for the win-back sequences your booking app will not automate. Your biggest drain is no-shows: a member takes a peak evening slot, fails to turn up, and you lose the capacity, the revenue and the chance to give that place to someone on the waitlist who would have used it. The hard part is not the no-shows themselves. It is that the system deciding who can book, how cancellations work and whether a deposit is taken is not yours to change. You bend your studio to its class-credit logic, its membership types and its app, and the member data you fought to win is held in a platform you do not control, while ClassPass quietly fills your off-peak slots with drop-ins who rarely come back.\\n\\nWe would replace that rented stack with one bespoke system you own outright, built around how your studio actually runs. At its centre is a live timetable on your own site where members book and pay direct, with a deposit or class credit taken upfront to hold the spot. That single rule is the most effective brake on no-shows there is, and it is backed by policies you set rather than inherit: a late cancellation or a no-show automatically deducts the credit or applies your charge, with no awkward conversation, and a waitlist auto-fills the moment someone drops out, so your busiest sessions stay full and the instructor is teaching a full room. Around that sits the rest of how a wellness business actually operates: membership, class-pack and PT-block management, a branded member portal under your own name, client records with intake, waivers, consent and PAR-Q screening, and recurring billing that automatically retries and chases a failed payment before a lapsed card quietly slips off your books. Memberships, packs and one-off bookings settle into a payment account you control, and your member list, attendance history and lapse data stay yours to keep, move and use for retention, so you can win back the off-peak slots and fill them with members who book you direct. The named tools you would stop renting include Mindbody, Glofox or TeamUp, ClassPass, a separate coaching app like Trainerize or TrueCoach, the booking platform's payment layer, and a bolt-on like Mailchimp.\\n\\nThe deeper point is this. Generic gym and studio software forces your business into its mould, its credit logic, its membership types, its billing cadence, its app, and the day that model stops matching how you actually run classes, PT blocks or hybrid coaching, you paper over the gaps with spreadsheets and manual messages. A bespoke system reverses that, so the booking rules, the no-show policy and the member journey are built around your studio rather than the studio bent around the software, and you stop renting the very engine that runs your timetable. This document is a free, indicative prospectus generated from a handful of answers. It is not a quote and not a finished plan. Booking a call turns this outline into a tailored, detailed consultation with a professional who maps your exact tools, timetable and member journey, then tells you plainly what is genuinely worth building first and what is not.",
      highlights: [
        "A deposit or class credit taken upfront to hold every spot, with no-shows and late cancellations handled automatically under policies you set, the most direct fix for the capacity you bleed on empty peak slots.",
        "One bespoke system you own outright replaces Mindbody, Glofox or TeamUp, ClassPass, a separate coaching app, the rented payment layer and a Mailchimp-style bolt-on, so you stop stitching your studio across tools you only rent.",
        "Waitlist auto-fill keeps your most popular classes full, while recurring billing retries and chases a failed payment before a lapsed card drops a member off your books.",
        "Your member list, attendance history and lapse data stay yours to keep, move and use, so you can win back the off-peak slots ClassPass fills with drop-ins and replace them with members who book you direct.",
      ],
    },
    {
      verticalId: "salon",
      painId: "payments",
      title:
        "Own Your Chair, Own Your Takings: A Bespoke Salon System That Cuts Out the Booking Middleman",
      narrative:
        "Right now your salon runs on rented booking software that was built to fill someone else's marketplace, not your appointment book. Treatwell and Fresha sit between you and the regular who walks through your own front door, while Booksy, Phorest, Timely and Mindbody charge you by the practitioner and keep your colour formulas, patch-test records and client history inside a database you are only ever renting. On payments, the area you have flagged, the problem is at its sharpest. Every deposit and every settled bill is routed through the platform's rails, so a slice of money you have already earned is skimmed before it ever reaches you, deposits are clumsy to take and hold against a future booking, and a no-show quietly costs you a chair you could have filled twice over. You did the work to win that client; the software takes a cut for simply standing in the doorway.\\n\\nWe would build you one bespoke system that you own outright, on your own salon domain, with card payments settling straight into your own account. Deposits are taken at the moment of booking for the services that warrant them, a full head of colour, a balayage correction, an infill set or an aesthetics consultation, and you decide which treatments need one and how much it is. Tiered reminders go out at forty-eight hours and again at two hours with one-tap confirm or reschedule, a smart waitlist offers a freed slot to the next client within minutes of a cancellation, and colour-refresh and treatment-recall nudges bring each client back at the right interval, all carrying your salon's name rather than a marketplace's. The rented stack can then be retired in full: the Treatwell and Fresha listings, the per-chair Booksy and Timely seats, the Phorest add-on tiers, the Mindbody or Pabau bundle. Your client cards, colour formulas, patch-test dates and consent forms travel with you and export cleanly, because they are yours to begin with. You own the system and pay only for the results it produces, never a charge that climbs each time you put another stylist in another chair.\\n\\nThe deeper point is this: you have been bending a chair-and-treatment business to fit tools designed around a marketplace's interests, not yours, so your service menu, your deposit rules and even your opening hours get shaped by what the software will allow, and your own loyal regulars are handed back to you dressed up as fresh leads. A system built around your salon turns that the right way round. Now, this Free Scaling Plan is an indicative prospectus rather than a quote or a finished build; it is generated from a handful of short answers to show you what is achievable. The detailed version comes from a conversation. Book a call and a Nullshift professional will walk through it with you properly, mapping every part to your actual salon, your services, your team, your rota and your numbers, and setting out a tailored plan and a case-by-case scope built around how you genuinely work.",
      highlights: [
        "Take deposits and full payment straight into your own account instead of a marketplace's rails, so the cut skimmed from money you have already earned stays inside your salon.",
        "Deposit-protected booking, tiered forty-eight-hour and two-hour reminders and a smart waitlist together mean a no-show no longer leaves you with an empty chair you cannot refill.",
        "Retire the whole rented stack, from the Treatwell and Fresha listings to the per-chair Booksy and Timely seats, for one bespoke system you own outright and that never costs more simply because you added another stylist.",
        "Your client cards, colour formulas, patch-test dates and consent records stay yours and export cleanly, rather than sitting locked inside a booking vendor's database.",
        "Book a call and a Nullshift professional maps this prospectus to your exact salon, services, team and rota, turning an auto-generated outline into a tailored, detailed plan and scope.",
      ],
    },
    {
      verticalId: "salon",
      painId: "noshows",
      title:
        "Salon scaling plan: fill every chair, stop renting access to your own clients",
      narrative:
        "Right now your salon runs on booking software built to fill a marketplace, not your column. Your calendar, client cards, colour formulas, patch-test records and reminder history all sit inside Treatwell, Fresha, Booksy, Phorest, Mindbody or Timely: platforms you rent rather than own, cannot fully query, and cannot cleanly walk away from. The cost lands hardest on the pain you flagged, no-shows. A late drop-out on a three-hour balayage is dead time you cannot refill at short notice, and the rented tools hand you one blunt, generic reminder rather than a routine tuned to how your clients actually behave. Worse, the regulars you spent years building are quietly logged as the marketplace's leads and shown your competitors down the road every time they rebook. What we would build instead is a single bespoke system you own outright, on your own domain, that retires that entire stack. At its heart is deposit-protected booking through your own payment account, so every colour, infill and consultation is held with real commitment and a late no-show stops meaning an empty chair you have no way to fill. Around it sits a tiered reminder cadence at 48 hours and 2 hours with one-tap confirm or reschedule; a smart waitlist that quietly offers a cancelled slot to the next suitable client and refills it within minutes; colour and treatment recall that turns a one-off visit into a predictable rebooking rhythm; patch-test and consent gating that keeps you insured and compliant without chasing paperwork by hand; and automatic win-back for regulars who have simply drifted. Your client records, formulas, consent history and before-and-after photos live in a system you control and can export on your own terms, never held hostage by a vendor. The deeper point is this: you have been bending your menu, your deposit rules and even your opening hours around what the software permits, because the marketplace's interests are not yours. A system built for your salon reverses that. Your clients are plainly yours, payments run through your own account, and the tooling stops getting more expensive every time you add a chair or a stylist. To be clear about what this document is: it is an indicative prospectus, auto-generated from a handful of answers you gave, not a quote and not a finished build. Booking a call is the next step, and a deliberate one. You get a tailored, detailed consultation with a professional who maps every part of this to your exact salon, your service menu and your real no-show numbers, pressure-tests what would genuinely move the needle, and sets out precisely what we would build and in what order.",
      highlights: [
        "Deposit-protected booking runs through your own payment account, so a late no-show stops meaning a three-hour colour slot you cannot refill in time",
        "Tiered 48-hour and 2-hour reminders with one-tap confirm, plus a waitlist that quietly offers a cancelled slot to the next suitable client and refills it within minutes",
        "Colour and treatment recall turns one-off visits into a predictable rebooking rhythm, win-back reclaims regulars who drifted, and patch-test and consent gating keeps you insured without chasing paperwork",
        "One system you own outright replaces Treatwell, Fresha, Booksy, Phorest, Mindbody and Timely; your formulas, consent records and client data stay yours, export cleanly, and stop being shown to the competitor down the road",
        "Booking a call gives you a tailored, detailed consultation with a professional who maps all of this to your exact salon, services and no-show numbers",
      ],
    },
    {
      verticalId: "trades",
      painId: "admin_overload",
      title:
        "Off the Friday-Night Phone: One System You Own for Quotes, Jobs, Certificates and Payment",
      narrative:
        "Right now your day runs across a stack of tools you rent but do not own. The jobs live in a field-service platform such as ServiceM8, Jobber or Tradify. The work comes off a directory like Checkatrade, MyBuilder or Rated People, which charges you for leads and lists your competitors on the same page. Certificates are written in a separate app, and card payments go through a Square, SumUp or Zettle reader that takes a slice of every transaction. The real problem is not any one of these tools; it is that none of them talk to each other. A quote sits in one place, the job sheet in another, the EICR or Gas Safety Record in a third, and the invoice somewhere else again, so the same address, customer and job details get re-keyed three or four times. Your whole job history sits inside platforms you would lose access to the day you stopped paying, and because nothing chases on your behalf, you are the one sending texts about deposits and sign-offs at nine o'clock on a Friday. That is what admin overload actually is: hours of your week spent being the human join between systems that were never built to connect.\n\nWhat we would build is one system that belongs to you, shaped around how your trade actually works rather than a template someone else designed. An accepted quote turns itself into a scheduled job with the materials, site address and assigned engineer already filled in. The customer gets an on-our-way alert, a deposit is taken through your own Stripe before the slot is held, and once the work is inspected and signed off, the matching certificate is generated, attached to the job and filed against the property automatically, so the paperwork follows the job instead of you re-typing it. Staged and final invoices raise themselves the moment a job is marked complete and chase on their own schedule until they are paid. In doing so, this one system replaces most of what you currently rent: the field-service platform, the separate certificate app, the card reader that clips every payment and the directory charging you for access to customers you have, in many cases, already earned. Every property record, certificate, sign-off and before-and-after photo lives in one place you control outright, and payments run through your own account, not a processor that sits in the middle taking a cut and never knowing which job the money belonged to.\n\nThe deeper point is the one most trades feel but rarely name. Generic field-service software quietly decides the shape of your business for you: its idea of a job, its quote layout, its payment flow. Spend a few years inside it and you end up bending a real trade to fit a piece of software. A system built around your actual workflow turns that around. The tool adapts to how you already work, the admin that has been eating your evenings is carried by the system rather than by you, and your records, your certificates and your customer relationships stay yours. This document is an indicative prospectus, not a quote or a finished plan. It is auto-generated from a handful of answers to show the shape of what is possible for a trade like yours. Booking a call turns it into a tailored, detailed consultation: a professional sits down with you, maps your exact workflow and current stack end to end, and confirms precisely what your own system would do and what it would let you stop renting, before a single thing is built.",
      highlights: [
        "Stop the re-keying: an accepted quote becomes a scheduled job with materials, address and engineer already in place, and a signed-off job files its own certificate against the property, so the same details are never typed twice across separate tools.",
        "Get off the Friday-night phone: deposit-gated bookings, on-our-way alerts and staged invoices that chase themselves mean the system handles the confirming and chasing you currently do by hand in the evenings.",
        "Own your records and your money: every property history, certificate, sign-off and photo lives in one system you control outright, with payments running through your own Stripe instead of a card reader clipping every job.",
        "Own your lead source too: enquiries come to you through your own site and your past customers, not a directory that charges you for leads and ranks your rivals right beside you.",
        "Book the call to make it exact: this prospectus is auto-generated from a few answers, while the consultation is a detailed, professional session that maps your real workflow and stack before anything is built.",
      ],
    },
    {
      verticalId: "trades",
      painId: "payments",
      title: "Own Your Money: A Trades System Built Around How You Actually Get Paid",
      narrative:
        "Right now your business runs on rented tools, and your money runs through other people's accounts. The job lives in ServiceM8, Jobber or Tradify. The leads come from Checkatrade or MyBuilder, where you pay to sit on a page beside your own rivals. And when the customer taps their card, a Square, SumUp or Zettle reader stands between them and your bank, skimming every deposit and every final payment and releasing your cash on someone else's timetable. Quotes, certificates and invoices sit in separate tools that do not talk to each other, so the same job address gets re-keyed three or four times, and you are still chasing deposits and sign-offs by text on a Friday night because nothing chases for you. The pain you named is payments. It is the clearest symptom of the real problem: the parts of your business that decide whether you get paid are not actually yours.\n\nWhat we would build is one bespoke system you own outright, shaped around how your trade really runs rather than how a software company assumes it should. Deposits, staged payments and final invoices settle straight into your own Stripe, with nothing sitting in the middle of your money and no platform holding the relationship with your customer. A diary slot is only held once a deposit has cleared, so time-wasters and no-shows never reach your calendar. An accepted quote turns itself into a scheduled job with the materials, site address and assigned fitter already filled in, so nobody re-types anything. On completion the right certificate, whether that is a Part P, an EICR, a Gas Safe record or a FENSA registration, is issued and filed against the property automatically, and staged invoices raise themselves on sign-off and chase, politely and on their own, until they are paid. One owned system does the work the directory, the card reader, the quoting suite and the bolt-on certificate tool currently do between them, and it holds every property, job history and customer record in a structure you control rather than one you only rent.\n\nThe deeper point is the one most trades only notice years in. Generic field-service software picks a shape of business for you, its idea of a job, its quote template, its payment flow, and you spend year after year quietly bending your real trade to fit its assumptions. A system built around your actual workflow reverses that: the tool bends to the business, not the business to the tool, and what it earns and protects compounds for you instead of for a platform. This plan is an indicative prospectus generated from a handful of answers. It is not a quote and not a finished design. Booking a call turns it into a tailored, detailed consultation, where a professional sits with you, maps your exact workflow and current stack end to end, and pressure-tests every assumption here before a single thing is built.",
      highlights: [
        "Your money lands in your own Stripe. Deposits, staged payments and final invoices settle into an account you own outright, with no card reader and no directory taking a cut or standing between you and your customer.",
        "A confirmed job is genuinely confirmed. A diary slot is held only once the deposit has cleared, so time-wasters and no-shows are filtered out before they ever reach your calendar.",
        "One owned system replaces the lot. The directory, the card reader, the quoting suite and the bolt-on certificate tool collapse into a single bespoke build, with every property, job history and certificate held in records you control rather than rent.",
        "Invoices and certificates that run themselves. Staged invoices raise on sign-off and chase until paid, and the right Part P, EICR, Gas Safe or FENSA record is issued and filed against the property automatically, never left sitting on someone's phone.",
        "The tool fits your trade, not the reverse. Instead of contorting your real workflow to match generic field-service software, the build is shaped around how you actually quote, schedule and get paid, then a booked call turns this indicative prospectus into a detailed, professional consultation that maps your exact stack before anything is built.",
      ],
    },
    {
      verticalId: "professional",
      painId: "tools",
      title: "One Practice, One System — Owned, Not Rented Per Seat",
      narrative:
        "Right now your practice runs on a stack of rented, per-seat tools, and not one of them belongs to you. Clio or Karbon holds your matters and workflow, Ignition handles proposals and engagement, Calendly takes the consultations, HubSpot runs the pipeline as a row of 'deals', and a separate intake form, e-signature and document store are bolted on top. Your client is scattered across five logins that do not talk to each other, so the same name and matter get re-keyed by hand, the true picture of the firm ends up in spreadsheets and in people's heads, and every fee-earner you take on is one more licence to buy. The invoices arrive every month whether the work came in or not, and the day you decide to leave, a clean export is made quietly difficult. You are renting the very system your practice depends on, and you cannot take it with you.\n\nWe would replace that stack with one bespoke system, built around the way your practice actually runs and owned by you outright. Engagement, conflict checks, matters, limitation dates, disbursements and recall would be first-class parts of the system rather than someone else's notion of a 'deal stage' or an 'envelope'. A signed engagement letter would open the matter, create the client record, trigger the conflict and ID checks and file itself, all on its own. AML and KYC would be chased automatically and would hold work until they clear. Recorded time, fixed fees and disbursements would gather into a draft bill on your own cycle, settled into your own account. A branded, UK-hosted client portal, intake and conflict-check forms, scoped proposals and engagement letters, and a single matter record you can export or migrate entirely on your terms would let you retire Clio or Karbon, Ignition, Calendly, HubSpot, PandaDoc or Proposify and DocuSign, and bring on associates, paralegals and consultant partners without the software bill climbing alongside every hire.\n\nThe insight beneath all of it is simple. Generic practice and CRM tools make you describe professional work in their vocabulary, so you bend your process to fit software that only half-fits, and pay per seat for the privilege. A system built around your matters, your deadlines and your client relationship bends to you instead. To be clear, this is a free, indicative prospectus, auto-generated from a handful of short answers. It is a considered starting point, not a quote and not a finished plan. Book a call and a professional will sit with you, map this to your exact practice, your stack and your compliance obligations, and turn it into a tailored, detailed plan with the scope set for your firm.",
      highlights: [
        "Five logins become one system you own outright: matters, conflict checks, limitation dates, disbursements, billing and the client portal in a single record, instead of Clio or Karbon, Ignition, Calendly, HubSpot, PandaDoc and DocuSign each renting you one piece of your own firm.",
        "Built in your vocabulary, not theirs: engagements, matters, limitation dates and recall are first-class parts of the system, so the true picture of the practice stops living in spreadsheets and in people's heads.",
        "Add fee-earners without adding licences: because the system is yours rather than priced per seat, you hire when the work justifies it, not when a licence forces it, with engagement, conflict checks and onboarding handled automatically.",
        "Your money and your matter record stay yours: payments land straight into your own account with no platform in the middle, and the full matter record is exportable and migratable on your terms, never a vendor's hostage.",
        "A free, indicative prospectus, not a quote: book a call and a professional maps it to your exact practice, stack and compliance obligations and turns it into a tailored, detailed plan for your firm.",
      ],
    },
  ],
};

import SwiftUI
import UniformTypeIdentifiers

struct ManagementHubView: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Periodi", destination: PeriodListView())
                NavigationLink("Relazioni", destination: ReportsView())
                NavigationLink("Fatture", destination: InvoicesView())
                NavigationLink("Documenti", destination: DocumentsView())
                NavigationLink("Trasferte", destination: TravelsView())
                NavigationLink("Impostazioni", destination: SettingsView())
            }
            .navigationTitle("Gestione")
        }
    }
}

struct PeriodListView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedEngagement: UUID?
    @State private var start = Date()
    @State private var end = Date()
    @State private var status: PeriodStatus = .draft

    var body: some View {
        Form {
            Section("Nuovo periodo") {
                Picker("Incarico", selection: $selectedEngagement) {
                    Text("-").tag(Optional<UUID>.none)
                    ForEach(store.engagements) { Text($0.title).tag(Optional($0.id)) }
                }
                DatePicker("Dal", selection: $start, displayedComponents: .date)
                DatePicker("Al", selection: $end, displayedComponents: .date)
                Picker("Stato", selection: $status) {
                    ForEach(PeriodStatus.allCases) { Text($0.rawValue).tag($0) }
                }
                Button("Salva periodo") {
                    guard let selectedEngagement else { return }
                    store.addOrUpdate(period: ReportingPeriod(engagementID: selectedEngagement, startDate: start, endDate: end, status: status))
                }
            }
            Section("Lista") {
                ForEach(store.periods) { period in
                    let totals = store.periodTotals(period: period)
                    VStack(alignment: .leading) {
                        Text("\(period.startDate, format: .dateTime.day().month().year()) - \(period.endDate, format: .dateTime.day().month().year())")
                        Text("\(period.status.rawValue) · worked \(totals.worked), fatturabili \(totals.fatturabili), € \(totals.amount, specifier: "%.2f")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Periodi")
        .onAppear { selectedEngagement = store.engagements.first?.id }
    }
}

struct ReportsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedPeriod: UUID?
    @State private var cover = ""
    @State private var preview = ""

    var body: some View {
        Form {
            Section("Genera relazione") {
                Picker("Periodo", selection: $selectedPeriod) {
                    Text("-").tag(Optional<UUID>.none)
                    ForEach(store.periods) { p in
                        Text("\(p.startDate, format: .dateTime.day().month()) - \(p.endDate, format: .dateTime.day().month())")
                            .tag(Optional(p.id))
                    }
                }
                TextField("Introduzione", text: $cover)
                Button("Genera") {
                    guard let pid = selectedPeriod,
                          let period = store.periods.first(where: { $0.id == pid }) else { return }
                    let days = store.workdays.filter {
                        $0.engagementID == period.engagementID &&
                        Calendar.current.startOfDay(for: $0.date) >= Calendar.current.startOfDay(for: period.startDate) &&
                        Calendar.current.startOfDay(for: $0.date) <= Calendar.current.startOfDay(for: period.endDate)
                    }
                    preview = (["Relazione", cover] + days.map { "\($0.date.formatted(date: .numeric, time: .omitted)): \($0.activities.joined(separator: ", "))" }).joined(separator: "\n")
                    store.add(report: ReportSnapshot(periodID: pid, title: "Relazione", cover: cover, content: preview))
                }
            }
            Section("Preview") { Text(preview).font(.footnote) }
            Section("Storico") { ForEach(store.reports) { Text($0.title + " - " + $0.createdAt.formatted(date: .abbreviated, time: .shortened)) } }
        }
        .navigationTitle("Relazioni")
        .onAppear { selectedPeriod = store.periods.first?.id }
    }
}

struct InvoicesView: View {
    @EnvironmentObject private var store: AppStore
    @State private var periodID: UUID?
    @State private var number = ""
    @State private var invoiceDate = Date()
    @State private var amount = 0.0
    @State private var term: PaymentTermType = .DF
    @State private var days = 30

    var body: some View {
        Form {
            Section("Nuova fattura") {
                Picker("Periodo", selection: $periodID) {
                    Text("-").tag(Optional<UUID>.none)
                    ForEach(store.periods) { p in Text("\(p.startDate.formatted(date: .numeric, time: .omitted)) - \(p.endDate.formatted(date: .numeric, time: .omitted))").tag(Optional(p.id)) }
                }
                TextField("Numero", text: $number)
                DatePicker("Data", selection: $invoiceDate, displayedComponents: .date)
                TextField("Importo", value: $amount, format: .number)
                Picker("Termine", selection: $term) { ForEach(PaymentTermType.allCases) { Text($0.rawValue).tag($0) } }
                Stepper("Giorni: \(days)", value: $days, in: 0...120)
                Button("Salva fattura") {
                    guard let periodID, let period = store.periods.first(where: { $0.id == periodID }) else { return }
                    let due = store.computeDueDate(invoiceDate: invoiceDate, term: term, days: days)
                    let inv = Invoice(engagementID: period.engagementID, periodID: periodID, invoiceNumber: number, invoiceDate: invoiceDate, amount: amount, paymentTermType: term, paymentTermDays: days, dueDate: due)
                    store.addOrUpdate(invoice: inv)
                }
            }
            Section("Registro") {
                ForEach(store.invoices) { inv in
                    VStack(alignment: .leading) {
                        Text(inv.invoiceNumber)
                        Text("€ \(inv.amount, specifier: "%.2f") · scadenza \(inv.dueDate.formatted(date: .numeric, time: .omitted))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Fatture")
        .onAppear { periodID = store.periods.first?.id }
    }
}

struct DocumentsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var type = ""
    @State private var status = "to_do"
    @State private var expiry = Date()
    @State private var hasExpiry = false

    var body: some View {
        Form {
            Section("Nuovo documento") {
                TextField("Tipo", text: $type)
                TextField("Stato", text: $status)
                Toggle("Con scadenza", isOn: $hasExpiry)
                if hasExpiry { DatePicker("Scadenza", selection: $expiry, displayedComponents: .date) }
                Button("Salva") {
                    store.addOrUpdate(document: DocumentItem(type: type, status: status, expiry: hasExpiry ? expiry : nil, notes: ""))
                    type = ""
                }
            }
            Section("Documenti") {
                ForEach(store.documents) { doc in
                    Text("\(doc.type) · \(doc.status)")
                }
            }
        }
        .navigationTitle("Documenti")
    }
}

struct TravelsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var engagementID: UUID?
    @State private var from = Date()
    @State private var to = Date()
    @State private var approval = "requested"
    @State private var expense = 0.0

    var body: some View {
        Form {
            Section("Nuova trasferta") {
                Picker("Incarico", selection: $engagementID) {
                    Text("-").tag(Optional<UUID>.none)
                    ForEach(store.engagements) { Text($0.title).tag(Optional($0.id)) }
                }
                DatePicker("Dal", selection: $from, displayedComponents: .date)
                DatePicker("Al", selection: $to, displayedComponents: .date)
                TextField("Stato approvazione", text: $approval)
                TextField("Totale spese", value: $expense, format: .number)
                Button("Salva") {
                    guard let engagementID else { return }
                    store.addOrUpdate(travel: TravelItem(engagementID: engagementID, from: from, to: to, approval: approval, expenseTotal: expense, notes: ""))
                }
            }
            Section("Trasferte") {
                ForEach(store.travels) { t in
                    Text("\(t.from.formatted(date: .numeric, time: .omitted)) - \(t.to.formatted(date: .numeric, time: .omitted)) · € \(t.expenseTotal, specifier: "%.2f")")
                }
            }
        }
        .navigationTitle("Trasferte")
        .onAppear { engagementID = store.engagements.first?.id }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var profile = UserProfile()
    @State private var exportDocument: BackupDocument?
    @State private var showExporter = false
    @State private var showImporter = false

    var body: some View {
        Form {
            Section("Profilo") {
                TextField("Nome", text: $profile.name)
                TextField("Email", text: $profile.email)
                TextField("P.IVA", text: $profile.vat)
                TextField("IBAN", text: $profile.iban)
                TextField("Lingua", text: $profile.language)
                TextField("Timezone", text: $profile.timezone)
                Button("Salva profilo") { store.updateProfile(profile) }
            }

            Section("Backup") {
                Button("Esporta backup") {
                    do {
                        exportDocument = try BackupDocument(data: store.exportBackup())
                        showExporter = true
                    } catch {
                        print(error.localizedDescription)
                    }
                }
                Button("Importa backup") { showImporter = true }
            }
        }
        .navigationTitle("Impostazioni")
        .onAppear { profile = store.profile }
        .fileExporter(isPresented: $showExporter, document: exportDocument, contentType: .json, defaultFilename: "timesheetapp-ios-backup") { _ in }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json]) { result in
            guard case let .success(url) = result,
                  let data = try? Data(contentsOf: url) else { return }
            try? store.importBackup(data)
            profile = store.profile
        }
    }
}

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { .init(regularFileWithContents: data) }
}

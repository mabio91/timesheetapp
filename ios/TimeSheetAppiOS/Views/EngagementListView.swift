import SwiftUI

struct EngagementListView: View {
    @EnvironmentObject private var store: AppStore
    @State private var editing: Engagement?
    @State private var showingForm = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(store.engagements) { engagement in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(engagement.title).font(.headline)
                        Text(engagement.clientName).foregroundStyle(.secondary)
                        Text("\(engagement.startDate, format: .dateTime.day().month().year()) - \(engagement.endDate, format: .dateTime.day().month().year())")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        editing = engagement
                        showingForm = true
                    }
                }
            }
            .navigationTitle("Incarichi")
            .toolbar {
                Button {
                    editing = nil
                    showingForm = true
                } label: {
                    Label("Nuovo", systemImage: "plus")
                }
            }
            .sheet(isPresented: $showingForm) {
                EngagementFormView(engagement: editing)
            }
        }
    }
}

struct EngagementFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: AppStore

    let engagement: Engagement?

    @State private var title = ""
    @State private var clientName = ""
    @State private var subject = ""
    @State private var startDate = Date()
    @State private var endDate = Date()
    @State private var dailyRate = 450.0
    @State private var maxFatturabili = ""
    @State private var weekendAllowed = false
    @State private var holidaysAllowed = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Titolo", text: $title)
                TextField("Committente", text: $clientName)
                TextField("Oggetto", text: $subject)
                DatePicker("Inizio", selection: $startDate, displayedComponents: .date)
                DatePicker("Fine", selection: $endDate, displayedComponents: .date)
                TextField("Tariffa giornaliera", value: $dailyRate, format: .number)
                    .keyboardType(.decimalPad)
                TextField("Max giorni fatturabili", text: $maxFatturabili)
                    .keyboardType(.numberPad)
                Toggle("Weekend consentiti", isOn: $weekendAllowed)
                Toggle("Festivi consentiti", isOn: $holidaysAllowed)
            }
            .navigationTitle(engagement == nil ? "Nuovo incarico" : "Modifica incarico")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        var row = engagement ?? Engagement(title: "", clientName: "", startDate: Date(), endDate: Date(), dailyRate: 0)
                        row.title = title
                        row.clientName = clientName
                        row.subject = subject
                        row.startDate = startDate
                        row.endDate = endDate
                        row.dailyRate = dailyRate
                        row.maxBillableDays = Int(maxFatturabili)
                        row.weekendAllowed = weekendAllowed
                        row.holidaysAllowed = holidaysAllowed
                        store.addOrUpdate(engagement: row)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
            }
            .onAppear {
                guard let e = engagement else { return }
                title = e.title
                clientName = e.clientName
                subject = e.subject
                startDate = e.startDate
                endDate = e.endDate
                dailyRate = e.dailyRate
                maxFatturabili = e.maxBillableDays.map(String.init) ?? ""
                weekendAllowed = e.weekendAllowed
                holidaysAllowed = e.holidaysAllowed
            }
        }
    }
}

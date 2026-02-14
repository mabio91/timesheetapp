import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore

    var totalFatturabili: Int {
        store.workdays.filter { $0.fatturabile && $0.status == .worked }.count
    }

    var totaleGuadagnoStimato: Double {
        store.engagements.reduce(0) { partial, engagement in
            let days = store.fatturabiliCount(for: engagement.id)
            return partial + (Double(days) * engagement.dailyRate)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("KPI") {
                    LabeledContent("Giornate fatturabili") { Text("\(totalFatturabili)") }
                    LabeledContent("Guadagno stimato") { Text(totaleGuadagnoStimato, format: .currency(code: "EUR")) }
                    LabeledContent("Incarichi attivi") {
                        Text("\(store.engagements.filter { $0.status == .active }.count)")
                    }
                }

                Section("Avanzamento incarichi") {
                    ForEach(store.engagements) { engagement in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(engagement.title).font(.headline)
                            let fatturabili = store.fatturabiliCount(for: engagement.id)
                            Text("Fatturabili: \(fatturabili) · Tariffa: \(engagement.dailyRate, format: .currency(code: "EUR"))")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if let max = engagement.maxBillableDays {
                                ProgressView(value: Double(fatturabili), total: Double(max))
                            }
                        }
                    }
                }
            }
            .navigationTitle("TimeSheetApp iOS")
        }
    }
}

import SwiftUI

struct WorkdayListView: View {
    @EnvironmentObject private var store: AppStore
    @State private var editing: Workday?
    @State private var showingForm = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(store.workdays) { day in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.date, format: .dateTime.day().month().year())
                            .font(.headline)
                        Text(store.engagements.first(where: { $0.id == day.engagementID })?.title ?? "-")
                            .foregroundStyle(.secondary)
                        Text("\(day.status.rawValue) · \(day.fatturabile ? "Fatturabile" : "Non fatturabile")")
                            .font(.caption)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        editing = day
                        showingForm = true
                    }
                }
                .onDelete { idx in
                    idx.map { store.workdays[$0].id }.forEach(store.removeWorkday)
                }
            }
            .navigationTitle("Giornate")
            .toolbar {
                Button {
                    editing = nil
                    showingForm = true
                } label: {
                    Label("Nuova", systemImage: "plus")
                }
            }
            .sheet(isPresented: $showingForm) {
                WorkdayFormView(workday: editing)
            }
        }
    }
}

struct WorkdayFormView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: AppStore

    let workday: Workday?

    @State private var engagementID: UUID?
    @State private var date = Date()
    @State private var status: WorkdayStatus = .worked
    @State private var fatturabile = true
    @State private var activities = ""
    @State private var note = ""
    @State private var errorMessage = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Incarico", selection: $engagementID) {
                    ForEach(store.engagements) { e in
                        Text(e.title).tag(Optional(e.id))
                    }
                }
                DatePicker("Data", selection: $date, displayedComponents: .date)
                Picker("Stato", selection: $status) {
                    ForEach(WorkdayStatus.allCases) { s in
                        Text(s.rawValue).tag(s)
                    }
                }
                Toggle("Fatturabile", isOn: $fatturabile)
                TextField("Attività (; separate)", text: $activities)
                TextField("Note", text: $note)
                if !errorMessage.isEmpty {
                    Text(errorMessage).foregroundStyle(.red).font(.caption)
                }
            }
            .navigationTitle(workday == nil ? "Nuova giornata" : "Modifica giornata")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        guard let engagementID else {
                            errorMessage = "Seleziona un incarico"
                            return
                        }
                        var row = workday ?? Workday(engagementID: engagementID, date: date, status: status, fatturabile: fatturabile)
                        row.engagementID = engagementID
                        row.date = date
                        row.status = status
                        row.fatturabile = fatturabile
                        row.activities = activities.split(separator: ";").map { $0.trimmingCharacters(in: .whitespaces) }
                        row.internalNote = note
                        do {
                            try store.addOrUpdate(workday: row)
                            dismiss()
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
            }
            .onAppear {
                engagementID = workday?.engagementID ?? store.engagements.first?.id
                guard let w = workday else { return }
                date = w.date
                status = w.status
                fatturabile = w.fatturabile
                activities = w.activities.joined(separator: "; ")
                note = w.internalNote
            }
        }
    }
}

struct CalendarMonthView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedMonth = Date()
    @State private var selectedEngagementID: UUID?

    private var days: [Date] {
        let cal = Calendar.current
        let range = cal.range(of: .day, in: .month, for: selectedMonth) ?? 1..<2
        let comps = cal.dateComponents([.year, .month], from: selectedMonth)
        return range.compactMap { day in
            cal.date(from: DateComponents(year: comps.year, month: comps.month, day: day))
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                DatePicker("Mese", selection: $selectedMonth, displayedComponents: .date)
                    .datePickerStyle(.compact)

                Picker("Incarico", selection: $selectedEngagementID) {
                    Text("-").tag(Optional<UUID>.none)
                    ForEach(store.engagements) { e in
                        Text(e.title).tag(Optional(e.id))
                    }
                }
                .pickerStyle(.menu)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 8) {
                    ForEach(["L", "M", "M", "G", "V", "S", "D"], id: \.self) { wd in
                        Text(wd).font(.caption).foregroundStyle(.secondary)
                    }

                    ForEach(days, id: \.self) { day in
                        DayCell(day: day, workday: workday(on: day), holidayName: ItalianHolidayCatalog.name(for: day))
                    }
                }
                Spacer()
            }
            .padding()
            .navigationTitle("Calendario mensile")
            .onAppear {
                selectedEngagementID = store.engagements.first?.id
            }
        }
    }

    private func workday(on day: Date) -> Workday? {
        guard let selectedEngagementID else { return nil }
        return store.workdays.first {
            $0.engagementID == selectedEngagementID && Calendar.current.isDate($0.date, inSameDayAs: day)
        }
    }
}

private struct DayCell: View {
    let day: Date
    let workday: Workday?
    let holidayName: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(day, format: .dateTime.day())
                .font(.subheadline.bold())
            if let workday {
                Text(workday.status.rawValue)
                    .font(.caption2)
                    .padding(4)
                    .background(.green.opacity(workday.status == .worked ? 0.3 : 0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            } else if let holidayName {
                Text(holidayName)
                    .font(.caption2)
                    .lineLimit(2)
                    .foregroundStyle(.orange)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .topLeading)
        .padding(6)
        .background(Color(white: 0.95).opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

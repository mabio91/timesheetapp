import Foundation

@MainActor
final class AppStore: ObservableObject {
    @Published var profile = UserProfile()
    @Published var engagements: [Engagement] = []
    @Published var workdays: [Workday] = []
    @Published var periods: [ReportingPeriod] = []
    @Published var invoices: [Invoice] = []
    @Published var documents: [DocumentItem] = []
    @Published var travels: [TravelItem] = []
    @Published var reports: [ReportSnapshot] = []
    @Published var audit: [AuditEvent] = []

    private let fileURL: URL

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        fileURL = docs.appendingPathComponent("timesheetapp-ios.json")
        load()
    }

    func addOrUpdate(engagement: Engagement) {
        if let idx = engagements.firstIndex(where: { $0.id == engagement.id }) {
            engagements[idx] = engagement
            log(entity: "engagement", message: "updated \(engagement.title)")
        } else {
            engagements.insert(engagement, at: 0)
            log(entity: "engagement", message: "created \(engagement.title)")
        }
        save()
    }

    func addOrUpdate(workday: Workday) throws {
        guard let engagement = engagements.first(where: { $0.id == workday.engagementID }) else {
            throw AppError("Incarico non trovato")
        }

        if workday.status == .worked && !engagement.weekendAllowed {
            let weekday = Calendar.current.component(.weekday, from: workday.date)
            if weekday == 1 || weekday == 7 { throw AppError("Weekend bloccato per questo incarico") }
        }
        if workday.status == .worked && !engagement.holidaysAllowed && ItalianHolidayCatalog.isHoliday(workday.date) {
            throw AppError("Festivo bloccato per questo incarico")
        }

        let current = workdays.filter {
            $0.engagementID == workday.engagementID && $0.fatturabile && $0.status == .worked && $0.id != workday.id
        }.count
        if workday.fatturabile, let max = engagement.maxBillableDays, current >= max {
            throw AppError("Massimo giorni fatturabili raggiunto")
        }

        if let idx = workdays.firstIndex(where: { $0.id == workday.id }) {
            workdays[idx] = workday
            log(entity: "workday", message: "updated \(workday.id.uuidString)")
        } else {
            workdays.insert(workday, at: 0)
            log(entity: "workday", message: "created \(workday.id.uuidString)")
        }
        save()
    }

    func removeWorkday(id: UUID) {
        workdays.removeAll { $0.id == id }
        save()
    }

    func addOrUpdate(period: ReportingPeriod) {
        if let idx = periods.firstIndex(where: { $0.id == period.id }) { periods[idx] = period } else { periods.insert(period, at: 0) }
        log(entity: "period", message: "saved \(period.id.uuidString)")
        save()
    }

    func addOrUpdate(invoice: Invoice) {
        if let idx = invoices.firstIndex(where: { $0.id == invoice.id }) { invoices[idx] = invoice } else { invoices.insert(invoice, at: 0) }
        log(entity: "invoice", message: "saved \(invoice.invoiceNumber)")
        save()
    }

    func addOrUpdate(document: DocumentItem) {
        if let idx = documents.firstIndex(where: { $0.id == document.id }) { documents[idx] = document } else { documents.insert(document, at: 0) }
        save()
    }

    func addOrUpdate(travel: TravelItem) {
        if let idx = travels.firstIndex(where: { $0.id == travel.id }) { travels[idx] = travel } else { travels.insert(travel, at: 0) }
        save()
    }

    func add(report: ReportSnapshot) {
        reports.insert(report, at: 0)
        save()
    }

    func updateProfile(_ profile: UserProfile) {
        self.profile = profile
        save()
    }

    func fatturabiliCount(for engagementID: UUID) -> Int {
        workdays.filter { $0.engagementID == engagementID && $0.fatturabile && $0.status == .worked }.count
    }

    func workedCount(for engagementID: UUID) -> Int {
        workdays.filter { $0.engagementID == engagementID && $0.status == .worked }.count
    }

    func amountEstimated(for engagementID: UUID) -> Double {
        guard let engagement = engagements.first(where: { $0.id == engagementID }) else { return 0 }
        return Double(fatturabiliCount(for: engagementID)) * engagement.dailyRate
    }

    func periodTotals(period: ReportingPeriod) -> (worked: Int, fatturabili: Int, amount: Double) {
        let days = workdays.filter { $0.engagementID == period.engagementID && Calendar.current.startOfDay(for: $0.date) >= Calendar.current.startOfDay(for: period.startDate) && Calendar.current.startOfDay(for: $0.date) <= Calendar.current.startOfDay(for: period.endDate) }
        let worked = days.filter { $0.status == .worked }.count
        let fatturabili = days.filter { $0.status == .worked && $0.fatturabile }.count
        let rate = engagements.first(where: { $0.id == period.engagementID })?.dailyRate ?? 0
        return (worked, fatturabili, Double(fatturabili) * rate)
    }

    func computeDueDate(invoiceDate: Date, term: PaymentTermType, days: Int) -> Date {
        switch term {
        case .DF: return Calendar.current.date(byAdding: .day, value: days, to: invoiceDate) ?? invoiceDate
        case .DFFM:
            let comps = Calendar.current.dateComponents([.year, .month], from: invoiceDate)
            let monthStart = Calendar.current.date(from: comps) ?? invoiceDate
            let monthEnd = Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: monthStart) ?? invoiceDate
            return Calendar.current.date(byAdding: .day, value: days, to: monthEnd) ?? invoiceDate
        }
    }

    func exportBackup() throws -> Data { try JSONEncoder.pretty.encode(snapshot()) }

    func importBackup(_ data: Data) throws {
        let decoded = try JSONDecoder.app.decodedSnapshot(from: data)
        profile = decoded.profile
        engagements = decoded.engagements
        workdays = decoded.workdays
        periods = decoded.periods
        invoices = decoded.invoices
        documents = decoded.documents
        travels = decoded.travels
        reports = decoded.reports
        audit = decoded.audit
        log(entity: "system", message: "backup restored")
        save()
    }

    private func snapshot() -> AppSnapshot {
        AppSnapshot(profile: profile, engagements: engagements, workdays: workdays, periods: periods, invoices: invoices, documents: documents, travels: travels, reports: reports, audit: audit)
    }

    private func log(entity: String, message: String) {
        audit.insert(AuditEvent(entity: entity, message: message), at: 0)
    }

    private func save() {
        do { try JSONEncoder.pretty.encode(snapshot()).write(to: fileURL, options: [.atomic]) }
        catch { print("Save error: \(error)") }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL), let snap = try? JSONDecoder.app.decodedSnapshot(from: data) else { return }
        profile = snap.profile
        engagements = snap.engagements
        workdays = snap.workdays
        periods = snap.periods
        invoices = snap.invoices
        documents = snap.documents
        travels = snap.travels
        reports = snap.reports
        audit = snap.audit
    }
}

struct AppError: LocalizedError {
    private let msg: String
    init(_ message: String) { self.msg = message }
    var errorDescription: String? { msg }
}

private extension JSONEncoder {
    static var pretty: JSONEncoder {
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        return enc
    }
}

private extension JSONDecoder {
    static var app: JSONDecoder {
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        return dec
    }
    func decodedSnapshot(from data: Data) throws -> AppSnapshot { try decode(AppSnapshot.self, from: data) }
}

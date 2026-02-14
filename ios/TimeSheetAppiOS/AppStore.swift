import Foundation

@MainActor
final class AppStore: ObservableObject {
    @Published var engagements: [Engagement] = []
    @Published var workdays: [Workday] = []
    @Published var audit: [AuditEvent] = []

    private let fileURL: URL

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.fileURL = docs.appendingPathComponent("timesheetapp-ios.json")
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
            throw NSError(domain: "TimeSheet", code: 404, userInfo: [NSLocalizedDescriptionKey: "Incarico non trovato"])
        }

        if workday.status == .worked && !engagement.weekendAllowed {
            let weekday = Calendar.current.component(.weekday, from: workday.date)
            if weekday == 1 || weekday == 7 {
                throw NSError(domain: "TimeSheet", code: 400, userInfo: [NSLocalizedDescriptionKey: "Weekend bloccato per questo incarico"])
            }
        }

        if workday.status == .worked && !engagement.holidaysAllowed && ItalianHolidayCatalog.isHoliday(workday.date) {
            throw NSError(domain: "TimeSheet", code: 400, userInfo: [NSLocalizedDescriptionKey: "Festivo bloccato per questo incarico"])
        }

        let currentFatturabili = workdays.filter {
            $0.engagementID == workday.engagementID &&
            $0.fatturabile &&
            $0.status == .worked &&
            $0.id != workday.id
        }.count

        if workday.fatturabile, let max = engagement.maxBillableDays, currentFatturabili >= max {
            throw NSError(domain: "TimeSheet", code: 400, userInfo: [NSLocalizedDescriptionKey: "Massimo giorni fatturabili raggiunto"])
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
        log(entity: "workday", message: "deleted \(id.uuidString)")
        save()
    }

    func fatturabiliCount(for engagementID: UUID) -> Int {
        workdays.filter { $0.engagementID == engagementID && $0.fatturabile && $0.status == .worked }.count
    }

    func exportBackup() throws -> Data {
        try JSONEncoder.pretty.encode(snapshot())
    }

    func importBackup(_ data: Data) throws {
        let decoded = try JSONDecoder.app.decodedSnapshot(from: data)
        engagements = decoded.engagements
        workdays = decoded.workdays
        audit = decoded.audit
        log(entity: "system", message: "backup restored")
        save()
    }

    private func snapshot() -> AppSnapshot {
        AppSnapshot(engagements: engagements, workdays: workdays, audit: audit)
    }

    private func log(entity: String, message: String) {
        audit.insert(AuditEvent(entity: entity, message: message), at: 0)
    }

    private func save() {
        do {
            let data = try JSONEncoder.pretty.encode(snapshot())
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            print("Save error: \(error)")
        }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let snap = try? JSONDecoder.app.decodedSnapshot(from: data) else {
            return
        }
        engagements = snap.engagements
        workdays = snap.workdays
        audit = snap.audit
    }
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

    func decodedSnapshot(from data: Data) throws -> AppSnapshot {
        try decode(AppSnapshot.self, from: data)
    }
}

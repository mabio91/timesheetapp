import Foundation

enum ItalianHolidayCatalog {
    // Explicit list requested by product scope (2026-2027 only).
    static let fixed: [String: String] = [
        "2026-01-01": "Capodanno",
        "2026-01-06": "Epifania",
        "2026-04-05": "Pasqua",
        "2026-04-06": "Lunedì di Pasqua (Pasquetta)",
        "2026-04-25": "Liberazione Italia",
        "2026-05-01": "Festa del lavoro",
        "2026-06-02": "Festa della Repubblica Italia",
        "2026-08-15": "Ferragosto",
        "2026-10-04": "Festa di San Francesco d’Assisi",
        "2026-11-01": "Tutti i santi",
        "2026-12-08": "Immacolata Concezione",
        "2026-12-25": "Natale",
        "2026-12-26": "Santo Stefano",
        "2027-01-01": "Capodanno",
        "2027-01-06": "Epifania",
        "2027-03-28": "Pasqua",
        "2027-03-29": "Lunedì di Pasqua (Pasquetta)",
        "2027-04-25": "Liberazione Italia",
        "2027-05-01": "Festa del lavoro",
        "2027-06-02": "Festa della Repubblica Italia",
        "2027-08-15": "Ferragosto",
        "2027-10-04": "Festa di San Francesco d’Assisi",
        "2027-11-01": "Tutti i santi",
        "2027-12-08": "Immacolata Concezione",
        "2027-12-25": "Natale",
        "2027-12-26": "Santo Stefano"
    ]

    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    static func key(for date: Date) -> String {
        iso.string(from: date)
    }

    static func name(for date: Date) -> String? {
        fixed[key(for: date)]
    }

    static func isHoliday(_ date: Date) -> Bool {
        name(for: date) != nil
    }
}

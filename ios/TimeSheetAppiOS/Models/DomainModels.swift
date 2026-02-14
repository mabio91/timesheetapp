import Foundation

enum EngagementStatus: String, Codable, CaseIterable, Identifiable {
    case active, closed, suspended
    var id: String { rawValue }
}

enum WorkdayStatus: String, Codable, CaseIterable, Identifiable {
    case worked = "worked"
    case nonWorked = "non-worked"
    case blocked = "blocked"
    case holiday = "holiday"
    case weekend = "weekend"
    var id: String { rawValue }
}

enum PeriodStatus: String, Codable, CaseIterable, Identifiable {
    case draft, ready, submitted, approved, rejected, invoiced
    var id: String { rawValue }
}

enum PaymentTermType: String, Codable, CaseIterable, Identifiable {
    case DF, DFFM
    var id: String { rawValue }
}

enum InvoiceStatus: String, Codable, CaseIterable, Identifiable {
    case prepared, sent, paid, overdue
    var id: String { rawValue }
}

struct Engagement: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var title: String
    var clientName: String
    var subject: String = ""
    var startDate: Date
    var endDate: Date
    var dailyRate: Double
    var maxBillableDays: Int?
    var weekendAllowed: Bool = false
    var holidaysAllowed: Bool = false
    var status: EngagementStatus = .active
}

struct Workday: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var engagementID: UUID
    var date: Date
    var status: WorkdayStatus
    var fatturabile: Bool
    var activities: [String] = []
    var internalNote: String = ""
}

struct ReportingPeriod: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var engagementID: UUID
    var startDate: Date
    var endDate: Date
    var status: PeriodStatus = .draft
    var notes: String = ""
}

struct Invoice: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var engagementID: UUID
    var periodID: UUID
    var invoiceNumber: String
    var invoiceDate: Date
    var amount: Double
    var paymentTermType: PaymentTermType
    var paymentTermDays: Int
    var dueDate: Date
    var status: InvoiceStatus = .prepared
    var notes: String = ""
}

struct DocumentItem: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var engagementID: UUID?
    var type: String
    var status: String
    var expiry: Date?
    var notes: String
}

struct TravelItem: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var engagementID: UUID
    var from: Date
    var to: Date
    var approval: String
    var expenseTotal: Double
    var notes: String
}

struct ReportSnapshot: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var periodID: UUID
    var title: String
    var cover: String
    var createdAt: Date = Date()
    var content: String
}

struct UserProfile: Codable, Equatable {
    var name: String = ""
    var email: String = ""
    var vat: String = ""
    var iban: String = ""
    var language: String = "it"
    var timezone: String = "Europe/Rome"
}

struct AuditEvent: Identifiable, Codable {
    var id: UUID = UUID()
    var date: Date = Date()
    var entity: String
    var message: String
}

struct AppSnapshot: Codable {
    var profile: UserProfile
    var engagements: [Engagement]
    var workdays: [Workday]
    var periods: [ReportingPeriod]
    var invoices: [Invoice]
    var documents: [DocumentItem]
    var travels: [TravelItem]
    var reports: [ReportSnapshot]
    var audit: [AuditEvent]
}

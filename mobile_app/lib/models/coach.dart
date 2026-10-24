class Coach {
  final String id;
  final String name;
  final String specialty;
  final String modelType; // percentage | per_session | monthly_fixed
  final int modelVal;
  final String modelLabel;
  final String phone;
  int settledAmount;

  Coach({
    required this.id,
    required this.name,
    required this.specialty,
    required this.modelType,
    required this.modelVal,
    required this.modelLabel,
    required this.phone,
    required this.settledAmount,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'specialty': specialty,
      'modelType': modelType,
      'modelVal': modelVal,
      'modelLabel': modelLabel,
      'phone': phone,
      'settledAmount': settledAmount,
    };
  }

  factory Coach.fromMap(Map<String, dynamic> map) {
    return Coach(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      specialty: map['specialty'] ?? '',
      modelType: map['modelType'] ?? 'percentage',
      modelVal: map['modelVal'] ?? 0,
      modelLabel: map['modelLabel'] ?? '',
      phone: map['phone'] ?? '',
      settledAmount: map['settledAmount'] ?? 0,
    );
  }
}

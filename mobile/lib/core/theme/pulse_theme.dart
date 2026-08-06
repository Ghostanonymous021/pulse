import 'package:flutter/material.dart';

abstract final class PulseColors {
  static const brand = Color(0xFF2563EB);
  static const brandForeground = Color(0xFFF8FAFC);
  static const zinc950 = Color(0xFF09090B);
}

ThemeData pulseDarkTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: PulseColors.brand,
      brightness: Brightness.dark,
      primary: PulseColors.brand,
      surface: PulseColors.zinc950,
    ),
    scaffoldBackgroundColor: PulseColors.zinc950,
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: PulseColors.zinc950,
      elevation: 0,
      scrolledUnderElevation: 0.5,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: PulseColors.brand,
        foregroundColor: PulseColors.brandForeground,
        shape: const StadiumBorder(),
      ),
    ),
  );
}

ThemeData pulseLightTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.fromSeed(
      seedColor: PulseColors.brand,
      brightness: Brightness.light,
      primary: PulseColors.brand,
    ),
  );
  return base.copyWith(
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: PulseColors.brand,
        foregroundColor: PulseColors.brandForeground,
        shape: const StadiumBorder(),
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:flutter/services.dart';
import 'dart:convert';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MaterialApp(
    home: TeenPattiApp(),
    debugShowCheckedModeBanner: false,
  ));
}

class TeenPattiApp extends StatefulWidget {
  const TeenPattiApp({super.key});

  @override
  State<TeenPattiApp> createState() => _TeenPattiAppState();
}

class _TeenPattiAppState extends State<TeenPattiApp> {
  late final WebViewController controller;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..loadFlutterAsset('assets/www/index.html');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      body: SafeArea(
        child: WebViewWidget(controller: controller),
      ),
    );
  }
}

package main

import (
	"log"
	"net/http"
	"predictball_api/handlers"
	"predictball_api/services"
)

func main() {
	svc := services.NewTemplateService()
	h := handlers.NewAPIHandler(svc)

	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux, h)

	port := ":8080"
	log.Printf("Starting server on port %s", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

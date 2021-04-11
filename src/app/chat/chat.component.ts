import { Component, OnInit } from '@angular/core';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { environment } from 'src/environments/environment';
import { Mensaje } from './models/mensaje';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit {
  private clientStomp: Client;
  conectado: boolean = false;
  mensaje: Mensaje = new Mensaje();
  mensajes: Mensaje[] = [];
  escribiendo: string;
  clienteId: string;

  constructor() {
    this.clienteId =
      'id-' +
      new Date().getUTCMilliseconds() +
      '-' +
      Math.random().toString(36).substr(2);
    console.log(this.clienteId);
  }

  ngOnInit(): void {
    this.clientStomp = new Client();
    this.clientStomp.webSocketFactory = () => {
      /* sockJS genera la conexion se le pasa por parametro el endpoint del websocket del back */
      return new SockJS(environment.url + '/chatwebsocket');
    };

    /* se deben configurar los eventos de conexion y/o desconexion */
    this.clientStomp.onConnect = (frame) => {
      console.log('Conectado: ' + this.clientStomp.connected + ' : ' + frame);
      this.conectado = true;

      /* se subscribe a los eventos de mensaje para recivir los mensajes desde el servidor */
      this.clientStomp.subscribe('/chat/message', (e) => {
        console.log('subcribed: ' + this.clientStomp.connected + ' : ' + frame);
        let mensaje: Mensaje = JSON.parse(e.body) as Mensaje;
        mensaje.fecha = new Date(mensaje.fecha);

        if (
          !this.mensaje.color &&
          mensaje.tipo == 'NUEVO_USUARIO' &&
          this.mensaje.username == mensaje.username
        ) {
          this.mensaje.color = mensaje.color;
        }
        this.mensajes.push(mensaje);
      });

      /* se suscribe al evento que avisa que el usuario esta escribiendo */
      this.clientStomp.subscribe('/chat/escribiendo', (e) => {
        this.escribiendo = e.body;
        setTimeout(() => (this.escribiendo = ''), 5000);
      });

      this.clientStomp.subscribe('/chat/historial/' + this.clienteId, (e) => {
        const historial = JSON.parse(e.body) as Mensaje[];
        this.mensajes = historial
          .map((m) => {
            m.fecha = new Date(m.fecha);
            return m;
          })
          .reverse();
      });

      this.clientStomp.publish({
        destination: '/app/historial',
        body: this.clienteId,
      });

      /* Envia mensaje cuando inicia sesión, el metodo publish hace el llamado directo a la funcion */
      this.mensaje.tipo = 'NUEVO_USUARIO';
      this.clientStomp.publish({
        destination: '/app/mensaje',
        body: JSON.stringify(this.mensaje),
      });
    };

    /* evento de asociado a la deconexion contra el socket */
    this.clientStomp.onDisconnect = (frame) => {
      console.log(
        'Desconectado: ' + !this.clientStomp.connected + ' : ' + frame
      );
      this.conectado = false;
      this.mensaje = new Mensaje();
      this.mensajes = [];
    };
  }

  conectar(): void {
    this.clientStomp.activate();
  }

  desconectar(): void {
    this.clientStomp.deactivate();
  }

  enviarMensaje(): void {
    this.mensaje.tipo = 'MENSAJE';

    this.clientStomp.publish({
      destination: '/app/mensaje',
      body: JSON.stringify(this.mensaje),
    });
    this.mensaje.texto = '';
  }

  escribiendoEvento(): void {
    this.clientStomp.publish({
      destination: '/app/escribiendo',
      body: this.mensaje.username,
    });
  }
}

# Computer Networks Fundamentals

The OSI model has seven layers: Physical, Data Link, Network, Transport, Session, Presentation and Application. The TCP/IP model has four layers: Network Access (Link), Internet, Transport and Application. IP works at the Network layer, TCP and UDP at the Transport layer, and HTTP, DNS, FTP and SMTP at the Application layer.

TCP is connection-oriented and reliable: it uses a three-way handshake (SYN, SYN-ACK, ACK), sequence numbers, acknowledgements, retransmission, flow control and congestion control. UDP is connectionless and unreliable but fast, which suits streaming, gaming and DNS queries.

An IPv4 address is 32 bits, usually written in dotted decimal. A subnet mask separates the network part from the host part; CIDR notation such as /24 means 24 network bits. IPv6 uses 128-bit addresses. Private IPv4 ranges are 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. NAT lets many private addresses share one public address.

DNS translates domain names into IP addresses. HTTP is the request-response protocol of the web; HTTPS adds TLS encryption. Common status codes: 200 OK, 301 redirect, 404 not found, 500 server error. DHCP assigns IP addresses automatically. ARP maps an IP address to a MAC address on a local network.

A switch forwards frames using MAC addresses at the Data Link layer. A router forwards packets between networks using IP addresses at the Network layer. A hub simply repeats signals to all ports. Routing protocols include RIP (distance vector), OSPF (link state) and BGP (between autonomous systems).

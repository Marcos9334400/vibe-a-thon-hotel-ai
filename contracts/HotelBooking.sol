// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HotelBooking {

    struct Hotel {
        string name;
        string location;
        uint256 pricePerNight;
        bool isActive;
        uint256 trustScore;
        address payable owner;
    }

    struct Booking {
        address guest;
        uint256 hotelId;
        uint256 amount;
        bool isConfirmed;
        bool isDisputed;
        bool isPaid;
        uint256 timestamp;
    }

    struct Review {
        address reviewer;
        uint256 hotelId;
        uint8 rating;
        string comment;
        uint256 timestamp;
    }

    mapping(uint256 => Hotel) public hotels;
    mapping(uint256 => Booking) public bookings;
    mapping(uint256 => Review[]) public hotelReviews;

    uint256 public hotelCount = 0;
    uint256 public bookingCount = 0;
    address public owner;

    event HotelListed(uint256 hotelId, string name);
    event BookingCreated(uint256 bookingId, address guest, uint256 hotelId);
    event CheckInConfirmed(uint256 bookingId);
    event DisputeRaised(uint256 bookingId);
    event DisputeResolved(uint256 bookingId, bool refundedToGuest);
    event ReviewSubmitted(uint256 hotelId, uint8 rating);

    constructor() { owner = msg.sender; }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function listHotel(string memory _name, string memory _location, uint256 _pricePerNight) public {
        hotelCount++;
        hotels[hotelCount] = Hotel(_name, _location, _pricePerNight, true, 50, payable(msg.sender));
        emit HotelListed(hotelCount, _name);
    }

    function bookHotel(uint256 _hotelId) public payable {
        Hotel memory hotel = hotels[_hotelId];
        require(hotel.isActive, "Hotel not available");
        require(msg.value >= hotel.pricePerNight, "Not enough ETH");
        require(hotel.trustScore >= 40, "Trust score too low");
        bookingCount++;
        bookings[bookingCount] = Booking(msg.sender, _hotelId, msg.value, false, false, false, block.timestamp);
        emit BookingCreated(bookingCount, msg.sender, _hotelId);
    }

    function confirmCheckIn(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(msg.sender == booking.guest, "Only guest");
        require(!booking.isConfirmed, "Already confirmed");
        require(!booking.isDisputed, "Under dispute");
        booking.isConfirmed = true;
        booking.isPaid = true;
        hotels[booking.hotelId].owner.transfer(booking.amount);
        emit CheckInConfirmed(_bookingId);
    }

    function cancelBooking(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(msg.sender == booking.guest, "Only guest");
        require(!booking.isConfirmed, "Already checked in");
        require(!booking.isPaid, "Already paid");
        booking.isPaid = true;
        payable(booking.guest).transfer(booking.amount);
    }

    function submitReview(uint256 _hotelId, uint8 _rating, string memory _comment) public {
        require(_rating >= 1 && _rating <= 5, "Rating 1-5 only");
        hotelReviews[_hotelId].push(Review(msg.sender, _hotelId, _rating, _comment, block.timestamp));
        emit ReviewSubmitted(_hotelId, _rating);
    }

    function raiseDispute(uint256 _bookingId) public {
        Booking storage booking = bookings[_bookingId];
        require(msg.sender == booking.guest, "Only guest");
        require(!booking.isConfirmed, "Already confirmed");
        require(!booking.isPaid, "Already paid");
        booking.isDisputed = true;
        emit DisputeRaised(_bookingId);
    }

    function resolveDispute(uint256 _bookingId, bool _refundGuest) public onlyOwner {
        Booking storage booking = bookings[_bookingId];
        require(booking.isDisputed, "No dispute");
        require(!booking.isPaid, "Already paid");
        booking.isPaid = true;
        booking.isDisputed = false;
        if (_refundGuest) {
            payable(booking.guest).transfer(booking.amount);
        } else {
            hotels[booking.hotelId].owner.transfer(booking.amount);
        }
        emit DisputeResolved(_bookingId, _refundGuest);
    }

    function updateTrustScore(uint256 _hotelId, uint256 _newScore) public onlyOwner {
        require(_newScore <= 100, "Score 0-100 only");
        hotels[_hotelId].trustScore = _newScore;
    }

    function getHotel(uint256 _hotelId) public view returns (Hotel memory) { return hotels[_hotelId]; }
    function getBooking(uint256 _bookingId) public view returns (Booking memory) { return bookings[_bookingId]; }
    function getReviews(uint256 _hotelId) public view returns (Review[] memory) { return hotelReviews[_hotelId]; }
    function getBalance() public view returns (uint256) { return address(this).balance; }
}
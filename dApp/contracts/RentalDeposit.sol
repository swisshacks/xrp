// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract RentalDeposit {
    address public landlord;
    address public tenant;
    uint256 public depositAmount;
    bool public isDepositPaid;
    bool public isRefunded;
    bool public isSignedByTenant;
    bool public isRefundRecorded;
    uint256 public tenantShare;
    uint256 public landlordShare;

    event DepositPaid(address indexed payer, uint256 amount);
    event DepositRefunded(address indexed tenant, address indexed landlord, uint256 tenantShare, uint256 landlordShare);
    event ContractSigned(address indexed tenant);

    modifier onlyLandlord() {
        require(msg.sender == landlord, "Only landlord can call this function");
        _;
    }

    modifier onlyTenant() {
        require(msg.sender == tenant, "Only tenant can call this function");
        _;
    }

    modifier depositNotPaid() {
        require(!isDepositPaid, "Deposit has already been paid");
        _;
    }

    modifier depositPaid() {
        require(isDepositPaid, "Deposit has not been paid yet");
        _;
    }

    modifier notRefunded() {
        require(!isRefunded, "Deposit has already been refunded");
        _;
    }

    modifier tenantHasNotSigned() {
        require(!isSignedByTenant, "Tenant has already signed the contract");
        _;
    }

    modifier canSignContract() {
        require(isRefundRecorded, "Cannot sign contract until landlord recorded the deposit");
        _;
    }

    constructor(address _tenant, uint256 _depositAmount) {
        landlord = msg.sender;
        tenant = _tenant;
        require(_depositAmount > 0, "Deposit amount must be greater than 0");
        depositAmount = _depositAmount;
    }

    modifier correctDepositAmount() {
        require(msg.value == depositAmount, "Incorrect deposit amount");
        _;
    }

    function payDeposit() external payable onlyTenant depositNotPaid correctDepositAmount {
        isDepositPaid = true;
        emit DepositPaid(msg.sender, msg.value);
    }

    function refundDeposit(uint256 _tenantShare, uint256 _landlordShare) external onlyLandlord depositPaid notRefunded tenantHasNotSigned {
        require(_tenantShare + _landlordShare == depositAmount, "Invalid split amounts");

        // Perform property inspection logic here, if needed

        tenantShare = _tenantShare;
        landlordShare = _landlordShare;
        isRefunded = true;
        isRefundRecorded = true;

        emit DepositRefunded(tenant, landlord, tenantShare, landlordShare);
    }

    function signContract() external onlyTenant canSignContract tenantHasNotSigned {
        isSignedByTenant = true;

        // Transfer split amount to the tenant when the tenant signs the contract
        payable(tenant).transfer(depositAmount);

        emit ContractSigned(tenant);
    }

    function getDepositShares() external view returns (uint256 _tenantShare, uint256 _landlordShare) {
        require(isRefundRecorded, "Deposit refund has not been recorded yet");

        _tenantShare = tenantShare;
        _landlordShare = landlordShare;
    }

    // Fallback function to reject incoming Ether
    receive() external payable {
        revert("This contract does not accept Ether directly");
    }
}